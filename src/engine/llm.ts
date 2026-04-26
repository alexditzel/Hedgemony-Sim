import OpenAI from "openai";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getPlayerDeck } from "./rules";
import {
  CardIdSchema,
  PlayerIdSchema,
  type AdjudicationRequest,
  type CardId,
  type GameState,
  type PlayerId,
  type RedSignalState,
} from "./types";

// ----------------------------------------------------------------------------

const openai = new OpenAI({
  // This is OK since this web app will only ever be ran locally.
  dangerouslyAllowBrowser: true,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const medium_model = import.meta.env.TEST ? "gpt-5.4-nano" : "gpt-5.4-mini";

// ----------------------------------------------------------------------------

/**
 * Prints the game state in an LLM-friendly Markdown style.
 */
function printGameState(state: GameState): string {
  throw new Error("Unimplemented")
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
      { role: "user", content: JSON.stringify({ state, playerId, options }) },
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
      { role: "user", content: JSON.stringify({ state, playerId }) },
    ],
    text: {
      format: zodTextFormat(PlayDecisionSchema, "play_decision"),
    },
  });
  const parsed = response.output_parsed as z.infer<typeof PlayDecisionSchema>;
  if (parsed.kind === "play" && parsed.cardId) {
    return { kind: "play", cardId: parsed.cardId };
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
      { role: "user", content: JSON.stringify({ state }) },
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
        content: `You are the White Cell. Summarize the ${kind} for turn ${turn}.`,
      },
      { role: "user", content: JSON.stringify({ state, kind, turn }) },
    ],
    text: {
      format: zodTextFormat(SummarySchema, "summary"),
    },
  });
  return response.output_parsed!.summary;
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
      { role: "user", content: JSON.stringify({ state, request }) },
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
      { role: "user", content: JSON.stringify({ state, cardId }) },
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
      { role: "user", content: JSON.stringify({ state }) },
    ],
    text: {
      format: zodTextFormat(EventDecisionSchema, "event_decision"),
    },
  });
  return response.output_parsed!.cardId ?? undefined;
}
