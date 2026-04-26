import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
import type { ReviewItem } from "../components/diff";
import {
  CardIdSchema,
  EffectSchema,
  entryValue,
  entryValues,
  getPlayerDeck,
  PlayerIdSchema,
  type AdjudicationRequest,
  type AdjudicationResolution,
  type Card,
  type CardId,
  type GameState,
  type PlayerId,
  type RedSignalState
} from "./types";

// ----------------------------------------------------------------------------

const openai = new OpenAI({
  // This is OK since this web app will only ever be ran locally.
  dangerouslyAllowBrowser: true,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const medium_model = "gpt-5.4-mini";
// // const high_model = "gpt-5.5";

// ----------------------------------------------------------------------------

/**
 * Prints the game state in an LLM-friendly Markdown style.
 */
function printGameState(state: GameState): string {
  const parts: string[] = [];

  parts.push(`# Game State`);
  parts.push(`Scenario: ${state.scenario_title}`);
  parts.push(`Turn: ${state.turn} / ${state.max_turns}`);
  parts.push(`Phase: ${state.phase}`);
  if (state.active_player_id) parts.push(`Active Player: ${state.active_player_id}`);
  if (state.blue_subphase) parts.push(`Blue Subphase: ${state.blue_subphase}`);

  parts.push(`\n## Players`);
  for (const player of entryValues(state.players)) {
    parts.push(`### ${player.label} (${player.id})`);
    parts.push(`Side: ${player.side}`);
    parts.push(`Resource Points: ${player.resource_points} (Per turn: +${entryValue(state.per_turn_resources, player.id) ?? 0})`);
    parts.push(`Influence Points: ${player.influence_points}`);
    parts.push(`National Tech Level: ${player.national_tech_level}`);
    parts.push(`Victory Condition: ${player.victory_condition}`);
    parts.push(`Critical Capabilities:`);
    for (const capability of player.critical_capabilities) {
      parts.push(`  - ${capability.id}: ${capability.value}`);
    }
  }

  parts.push(`\n## Forces`);
  for (const force of entryValues(state.forces)) {
    let forceStr = `- ${force.id} (Owner: ${force.owner}): Location ${force.location_id}, Factors ${force.force_factors}, Mod ${force.modernization_level}`;
    if (force.readiness_level) forceStr += `, Readiness ${force.readiness_level}`;
    if (force.proxy) forceStr += ` [PROXY]`;
    parts.push(forceStr);
  }

  if (state.bases.length > 0) {
    parts.push(`\n## Bases`);
    for (const base of entryValues(state.bases)) {
      parts.push(`- ${base.id} (Owner: ${base.owner}): Location ${base.location_id}`);
    }
  }

  if (state.proxy_forces.length > 0) {
    parts.push(`\n## Proxy Forces`);
    for (const proxy of entryValues(state.proxy_forces)) {
      parts.push(`- ${proxy.id} (Sponsor: ${proxy.sponsor}): Location ${proxy.location_id}, Factors ${proxy.force_factors}, Mod ${proxy.modernization_level}, Reliability ${proxy.reliability}`);
    }
  }

  parts.push(`\n## Cards`);
  for (const card of entryValues(state.cards)) {
    parts.push(`### Card: ${card.id}`);
    parts.push(`Title: ${card.title}`);
    parts.push(`Type: ${card.type} (Owner: ${card.owner ?? "None"})`);
    parts.push(`Description: ${card.description}`);
    parts.push(`Cost: ${JSON.stringify(card.cost)}`);
    if (card.effects.length > 0) parts.push(`Effects: ${JSON.stringify(card.effects)}`);
    if (card.notes) parts.push(`Notes: ${card.notes}`);
  }

  parts.push(`\n## Locations`);
  for (const loc of entryValues(state.locations)) {
    parts.push(`- ${loc.id} (${loc.label}): Owner ${loc.country_owner ?? "None"}`);
  }

  parts.push(`\n## Red Sequencer`);
  parts.push(`Sequence: ${state.red_sequence.join(" -> ")}`);
  parts.push(`Active Index: ${state.active_red_index}`);

  if (state.red_signals.length > 0) {
    parts.push(`\n## Red Signals`);
    for (const sig of entryValues(state.red_signals)) {
      parts.push(`- ${sig.player_id}: Cards [${sig.card_ids.join(", ")}], Completed: ${sig.completed}`);
      if (sig.brief_summary) parts.push(`  Summary: ${sig.brief_summary}`);
      if (sig.activation_intent) parts.push(`  Intent: ${JSON.stringify(sig.activation_intent)}`);
    }
  }

  if (state.event_log.length > 0) {
    parts.push(`\n## Recent Events`);
    for (const event of state.event_log.slice(-10)) {
      parts.push(`- Turn ${event.turn} [${event.phase}]: ${event.message}`);
    }
  }

  return parts.join("\n");
}

function printAdjudicationRequest(request: AdjudicationRequest): string {
  const parts: string[] = [];
  parts.push(`# Adjudication Request: ${request.id}`);
  parts.push(`Turn: ${request.turn}, Phase: ${request.phase}`);
  parts.push(`Requested By: ${request.requested_by ?? "None"}`);
  parts.push(`Status: ${request.status}`);
  parts.push(`Reason: ${request.reason}`);
  if (request.card_id) parts.push(`Card ID: ${request.card_id}`);
  if (request.rule_refs.length > 0) parts.push(`Rule Refs: ${request.rule_refs.join(", ")}`);
  if (request.tags.length > 0) parts.push(`Tags: ${request.tags.join(", ")}`);
  if (request.payload) parts.push(`Payload: ${JSON.stringify(request.payload)}`);
  return parts.join("\n");
}

// ----------------------------------------------------------------------------

export type RedSignalDecision = {
  cardIds: CardId[];
  briefSummary: string;
  activationIntent: RedSignalState["activation_intent"];
};



export async function generateRedSignalDecision(
  state: GameState,
  playerId: PlayerId,
): Promise<RedSignalDecision> {
  const deck = getPlayerDeck(state, playerId);
  const actionCount = deck.filter((c) => c.type.toLowerCase() === "action").length;
  const investmentCount = deck.filter((c) => c.type.toLowerCase() === "investment").length;

  const options = deck.map((c) => `- ${c.id}: ${c.title} (${c.type})`);
  const optionIds = deck.map((c) => c.id);

  // Dynamic schema to ensure LLM only picks from available cards
  const LocalSignalDecisionSchema = z.object({
    cardIds: z.array(z.string()).min(1).max(3),
    briefSummary: z.string(),
    activationIntent: z.array(
      z.object({
        cardId: z.string(),
        intent: z.enum(["Yes", "No", "Undeclared"]),
      }),
    ),
  });

  const systemPrompt = `You are the Red player (${playerId}) in a military simulation game.
Choose between 1 and 3 cards to signal from your deck.
CRITICAL RULE: If you choose exactly 3 cards, at least one must be an Action and at least one must be an Investment.
Current available cards in your deck: ${actionCount} Actions, ${investmentCount} Investments.
If you have no Investments left, you CANNOT signal 3 cards; you must signal 1 or 2 cards instead.
Write a brief summary of your intent, and declare activation intents for each signaled card.`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Options (Card IDs, Titles, and Types):\n${options.join("\n")}\n\n${printGameState(state)}`,
    },
  ];

  let parsed: z.infer<typeof LocalSignalDecisionSchema> | null = null;
  let attempts = 0;

  while (attempts < 3) {
    const response = await openai.responses.parse({
      model: medium_model,
      input: messages,
      text: {
        format: zodTextFormat(LocalSignalDecisionSchema, "signal_decision"),
      },
    });

    parsed = response.output_parsed as z.infer<typeof LocalSignalDecisionSchema>;

    // Validate card existence and signaling mix rule
    const selectedCards = parsed.cardIds.map((id) => deck.find((c) => c.id === id));
    const allIdsValid = selectedCards.every((c) => !!c);

    if (!allIdsValid) {
      messages.push({ role: "assistant", content: JSON.stringify(parsed) });
      messages.push({
        role: "user",
        content: `ERROR: One or more of the Card IDs you selected are not in your available deck. Please choose only from the provided options: ${optionIds.join(", ")}`,
      });
      attempts++;
      continue;
    }

    const validCards = selectedCards.filter((c): c is Card => !!c);

    if (parsed.cardIds.length === 3) {
      const hasAction = validCards.some((c) => c.type.toLowerCase() === "action");
      const hasInvestment = validCards.some(
        (c) => c.type.toLowerCase() === "investment",
      );

      if (hasAction && hasInvestment) {
        break; // Valid mix
      } else {
        // Invalid mix, retry with correction
        messages.push({ role: "assistant", content: JSON.stringify(parsed) });
        messages.push({
          role: "user",
          content:
            "ERROR: Your selection of 3 cards does not include both an Action and an Investment. Please revise your selection to satisfy the rule, or select only 1 or 2 cards.",
        });
        attempts++;
      }
    } else {
      break; // 1 or 2 cards is always valid
    }
  }

  if (!parsed) {
    throw new Error("Failed to generate valid Red Signal decision");
  }

  return {
    cardIds: parsed.cardIds,
    briefSummary: parsed.briefSummary,
    activationIntent: parsed.activationIntent.map(({ cardId, intent }) => ({
      id: cardId,
      value: intent,
    })),
  };
}

export type RedPlayDecision =
  | { kind: "play"; cardId: CardId }
  | { kind: "skip" };

const PlayDecisionSchema = z.union([
  z.object({ kind: z.enum(["play"]), cardId: CardIdSchema }),
  z.object({ kind: z.enum(["skip"]) }),
]);

export async function generateRedPlayDecision(
  state: GameState,
  playerId: PlayerId,
): Promise<RedPlayDecision> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the Red player. Decide whether to play a signaled card or skip based on the current game state.",
      },
      {
        role: "user",
        content: `Player ID: ${playerId}\n\n${printGameState(state)}`
      },
    ],
    text: {
      format: zodTextFormat(z.object({ decision: PlayDecisionSchema }), "play_decision"),
    },
  });
  const parsed = response.output_parsed!;
  if (parsed.decision.kind === "play" && parsed.decision.cardId) {
    return { kind: "play", cardId: parsed.decision.cardId };
  } else {
    return { kind: "skip" };
  }
}

const SequenceDecisionSchema = z.object({
  sequence: z.array(PlayerIdSchema),
});

export async function generateRedSequenceDecision(
  state: GameState,
): Promise<PlayerId[]> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Decide the turn sequence for the Red players based on the current game state. Very critically each player must appear in the sequence exactly once.",
      },
      { role: "user", content: printGameState(state) },
    ],
    text: {
      format: zodTextFormat(SequenceDecisionSchema, "sequence_decision"),
    },
  });
  return response.output_parsed!.sequence;
}

const SummarySchema = z.object({ summary: z.string() });

export async function generateWhiteCellSummary(
  kind: "game_start" | "state_of_world",
  turn: number,
  state: GameState,
): Promise<string> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content: `You are the White Cell. Summarize the ${kind} for turn ${turn}. Treat the provided state as a real-world event and active crisis, not as a simulation, scenario, exercise, game, or fictional setup. Your summary must be an organized, detailed executive summary written in realistic real-world national security language. Do not use game abstractions or side labels such as "Red", "Blue", "Red team", or "Blue team"; refer to countries, alliances, agencies, commands, leaders, and forces by their real-world names from the state. Do not mention that this is a simulation, scenario, tabletop exercise, turn, card, or game artifact.`,
      },
      {
        role: "user",
        content: `${printGameState(state)}\n\nSummary Kind: ${kind}\nTurn: ${turn}`
      },
    ],
    text: {
      format: zodTextFormat(SummarySchema, "summary"),
    },
  });
  return response.output_parsed!.summary;
}

/**
 * Based on a natural-language summary, generate a few thematic newspaper articles and intel reports.
 */
export async function generateReviewItems(state: GameState, summary: string): Promise<ReviewItem[]> {
  const WorldNewspapersReviewItemSchema = z.object({
    kind: z.enum(["world_newspapers"]),
    summary: z.string().describe("A concise one-paragraph summary of a newspaper article."),
    label: z.string().describe("The newspaper publisher."),
    headline: z.string().describe("The newspaper article headline."),
  });
  const WorldIntelReviewItemSchema = z.object({
    kind: z.enum(["world_intel"]),
    summary: z.string().describe("A concise one-paragraph summary of an intel briefing."),
    label: z.string().describe("The intel report publisher."),
  });

  const ReviewItemsListSchema = z.object({
    newspaper1: WorldNewspapersReviewItemSchema,
    newspaper2: WorldNewspapersReviewItemSchema,
    intel1: WorldIntelReviewItemSchema
  });

  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Based on the provided summary and game state, generate two distinct realistic newspaper articles and one realistic intelligence briefing. Treat the provided state as a real-world event and active crisis, not as a simulation, scenario, exercise, game, or fictional setup. Do not use game abstractions or side labels such as \"Red\", \"Blue\", \"Red team\", or \"Blue team\" anywhere in the labels, headlines, or summaries; refer to countries, alliances, agencies, commands, leaders, and forces by their real-world names from the state. Do not mention turns, cards, players, phases, simulations, scenarios, exercises, or game artifacts. The newspaper articles should read like plausible international press coverage with credible mastheads, restrained headlines, and concrete geopolitical detail. The intelligence briefing should read like a real-world government analytic product, not a game recap. For each newspaper, generate the publisher label, the article headline, and the article summary together so the masthead, headline, and body all describe the same article.",
      },
      {
        role: "user",
        content: `Summary:\n${summary}\n\nGame State:\n${printGameState(state)}`,
      },
    ],
    text: {
      format: zodTextFormat(ReviewItemsListSchema, "review_items"),
    },
  });

  const items: ReviewItem[] = [
    { ...response.output_parsed!.newspaper1, turn: state.turn, },
    { ...response.output_parsed!.newspaper2, turn: state.turn, },
    { ...response.output_parsed!.intel1, turn: state.turn, }
  ]

  return items;
}



const ResolutionSchema = z.object({
  resolution: z.string().describe("Natural language description of the resolution."),
  effects: z.array(EffectSchema).describe("List of game engine effects to apply."),
});

export async function generateWhiteCellAdjudicationResolution(
  request: AdjudicationRequest,
  state: GameState,
): Promise<AdjudicationResolution> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell (adjudicator) in a military/political simulation game. Your task is to resolve an adjudication request by providing a natural language summary and a list of structured game effects. " +
          "Focus on making the resolution semantically meaningful and thematic while strictly adhering to the game's effect schema. " +
          "Common effects include: adjust_resource_points, adjust_influence_points, adjust_national_tech_level, move_forces, set_readiness_level, pin_forces, etc. " +
          "If the request is for a table adjustment, make sure to include the numeric result in the resolution text.",
      },
      {
        role: "user",
        content: `${printAdjudicationRequest(request)}\n\n${printGameState(state)}\n\nProvide the resolution and any applicable effects.`
      },
    ],
    text: {
      format: zodTextFormat(ResolutionSchema, "resolution_and_effects"),
    },
  });

  return response.output_parsed!;
}

const EventNoteSchema = z.object({ note: z.string() });

// TODO: look up card by ID and then print card details in prompt
export async function generateWhiteCellEventNote(
  cardId: CardId,
  state: GameState,
): Promise<string> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Decide why and how to inject a scenario event for the given card ID.",
      },
      {
        role: "user",
        content: `Card ID for Event: ${cardId}\n\n${printGameState(state)}`
      },
    ],
    text: {
      format: zodTextFormat(EventNoteSchema, "event_note"),
    },
  });
  return response.output_parsed!.note;
}

const EventDecisionSchema = z.object({ cardId: z.nullable(CardIdSchema) });

export async function generateWhiteCellEventDecision(
  state: GameState,
): Promise<CardId | undefined> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Decide whether to inject an event and which event to use.",
      },
      { role: "user", content: printGameState(state) },
    ],
    text: {
      format: zodTextFormat(EventDecisionSchema, "event_decision"),
    },
  });
  return response.output_parsed!.cardId ?? undefined;
}
