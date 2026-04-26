import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
import type { ReviewItem } from "../components/diff";
import { getPlayerDeck } from "./rules";
import {
  CardIdSchema,
  PlayerIdSchema,
  type AdjudicationRequest,
  type CardId,
  type GameState,
  type PlayerId,
  type RedSignalState
} from "./types";

// ----------------------------------------------------------------------------

const openai = new OpenAI({
  // This is OK since this web app will only ever be ran locally.
  dangerouslyAllowBrowser: true,
  // apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  apiKey: process.env.VITE_OPENAI_API_KEY,
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
  for (const player of Object.values(state.players)) {
    parts.push(`### ${player.label} (${player.id})`);
    parts.push(`Side: ${player.side}`);
    parts.push(`Resource Points: ${player.resource_points} (Per turn: +${state.per_turn_resources[player.id] ?? 0})`);
    parts.push(`Influence Points: ${player.influence_points}`);
    parts.push(`National Tech Level: ${player.national_tech_level}`);
    parts.push(`Victory Condition: ${player.victory_condition}`);
    parts.push(`Critical Capabilities:`);
    for (const [cap, val] of Object.entries(player.critical_capabilities)) {
      parts.push(`  - ${cap}: ${val}`);
    }
  }

  parts.push(`\n## Forces`);
  for (const force of Object.values(state.forces)) {
    let forceStr = `- ${force.id} (Owner: ${force.owner}): Location ${force.location_id}, Factors ${force.force_factors}, Mod ${force.modernization_level}`;
    if (force.readiness_level) forceStr += `, Readiness ${force.readiness_level}`;
    if (force.proxy) forceStr += ` [PROXY]`;
    parts.push(forceStr);
  }

  if (Object.keys(state.bases).length > 0) {
    parts.push(`\n## Bases`);
    for (const base of Object.values(state.bases)) {
      parts.push(`- ${base.id} (Owner: ${base.owner}): Location ${base.location_id}`);
    }
  }

  if (Object.keys(state.proxy_forces).length > 0) {
    parts.push(`\n## Proxy Forces`);
    for (const proxy of Object.values(state.proxy_forces)) {
      parts.push(`- ${proxy.id} (Sponsor: ${proxy.sponsor}): Location ${proxy.location_id}, Factors ${proxy.force_factors}, Mod ${proxy.modernization_level}, Reliability ${proxy.reliability}`);
    }
  }

  parts.push(`\n## Cards`);
  for (const card of Object.values(state.cards)) {
    parts.push(`### Card: ${card.id}`);
    parts.push(`Title: ${card.title}`);
    parts.push(`Type: ${card.type} (Owner: ${card.owner ?? "None"})`);
    parts.push(`Description: ${card.description}`);
    parts.push(`Cost: ${JSON.stringify(card.cost)}`);
    if (card.effects.length > 0) parts.push(`Effects: ${JSON.stringify(card.effects)}`);
    if (card.notes) parts.push(`Notes: ${card.notes}`);
  }

  parts.push(`\n## Locations`);
  for (const loc of Object.values(state.locations)) {
    parts.push(`- ${loc.id} (${loc.label}): Owner ${loc.country_owner ?? "None"}`);
  }

  parts.push(`\n## Red Sequencer`);
  parts.push(`Sequence: ${state.red_sequence.join(" -> ")}`);
  parts.push(`Active Index: ${state.active_red_index}`);

  if (Object.keys(state.red_signals).length > 0) {
    parts.push(`\n## Red Signals`);
    for (const sig of Object.values(state.red_signals)) {
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

const SignalDecisionSchema = z.object({
  cardIds: z.array(CardIdSchema),
  briefSummary: z.string(),
  activationIntent: z.array(
    z.object({
      cardId: CardIdSchema,
      intent: z.enum(["Yes", "No", "Undeclared"]),
    }),
  ),
});

export async function generateRedSignalDecision(
  state: GameState,
  playerId: PlayerId,
): Promise<RedSignalDecision> {
  const options = getPlayerDeck(state, playerId).map((c) => c.id);
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the Red player in a military simulation game. Choose between 1 and 3 cards to signal. Rule: If you choose exactly 3 cards, at least one must be an Action (has '-ACT-' in ID) and at least one must be an Investment (has '-INV-' in ID). Write a brief summary of your intent, and declare activation intents.",
      },
      {
        role: "user",
        content: `Player ID: ${playerId}\n\nOptions (Card IDs):\n${options.map((o) => `- ${o}`).join("\n")}\n\n${printGameState(state)}`,
      },
    ],
    text: {
      format: zodTextFormat(SignalDecisionSchema, "signal_decision"),
    },
  });

  const parsed = response.output_parsed as z.infer<typeof SignalDecisionSchema>;

  const activationIntentRecord: Record<CardId, "Yes" | "No" | "Undeclared"> =
    {};
  for (const { cardId, intent } of parsed.activationIntent) {
    activationIntentRecord[cardId] = intent;
  }

  return {
    cardIds: parsed.cardIds,
    briefSummary: parsed.briefSummary,
    activationIntent: activationIntentRecord,
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
          "You are the White Cell. Decide the turn sequence for the Red players based on the current game state.",
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
        content: `You are the White Cell. Summarize the ${kind} for turn ${turn}. Your summary must be an organized details executive summary.`,
      },
      {
        role: "user",
        content: `Summary Kind: ${kind}\nTurn: ${turn}\n\n${printGameState(state)}`
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
  const ReviewItemSchema = z.union([
    z.object({
      kind: z.enum(["world_newspapers"]),
      summary: z.string().describe("A concise one-paragraph summary of a newspaper article."),
      label: z.string().describe("The newspaper publisher."),
    }),
    z.object({
      kind: z.enum(["world_intel"]),
      summary: z.string().describe("A concise one-paragraph summary of an intel briefing."),
      label: z.string().describe("The intel report publisher."),
    })
  ]);

  const ReviewItemsListSchema = z.object({ items: z.array(ReviewItemSchema) });

  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Based on the provided summary and game state, generate a few thematic newspaper articles and intel reports.",
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

  return response.output_parsed!.items.map((item) => ({
    ...item,
    turn: state.turn,
  }));
}

const ResolutionSchema = z.object({ resolution: z.string() });

export async function generateWhiteCellAdjudicationResolution(
  request: AdjudicationRequest,
  state: GameState,
): Promise<string> {
  const response = await openai.responses.parse({
    model: medium_model,
    input: [
      {
        role: "system",
        content:
          "You are the White Cell. Resolve the adjudication request in rules-engine-compatible terms.",
      },
      {
        role: "user",
        content: `${printAdjudicationRequest(request)}\n\n${printGameState(state)}`
      },
    ],
    text: {
      format: zodTextFormat(ResolutionSchema, "resolution"),
    },
  });
  return response.output_parsed!.resolution;
}

const EventNoteSchema = z.object({ note: z.string() });

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

const EventDecisionSchema = z.object({ cardId: z.optional(CardIdSchema) });

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

