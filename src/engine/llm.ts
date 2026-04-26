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

const openai = new OpenAI({
  dangerouslyAllowBrowser: true,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export interface PlaceholderRedSignalDecision {
  cardIds: CardId[];
  briefSummary: string;
  activationIntent: RedSignalState["activation_intent"];
}

const SignalDecisionSchema = z.object({
  cardIds: z.array(CardIdSchema),
  briefSummary: z.string(),
  activationIntent: z.record(CardIdSchema, z.enum(["Yes", "No", "Undeclared"])),
});

export async function placeholderRedSignalDecision(
  state: GameState,
  playerId: PlayerId,
): Promise<PlaceholderRedSignalDecision> {
  const options = getPlayerDeck(state, playerId).map((c) => c.id);
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the Red player in a military simulation game. Choose your signaled cards, write a brief summary of your intent, and declare activation intents." },
      { role: "user", content: JSON.stringify({ state, playerId, options }) },
    ],
    text: {
      format: zodTextFormat(SignalDecisionSchema, "signal_decision"),
    },
  });
  return response.output_parsed as PlaceholderRedSignalDecision;
}

export type PlaceholderRedPlayDecision =
  | { kind: "play"; cardId: CardId }
  | { kind: "skip" };

const PlayDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("play"), cardId: CardIdSchema }),
  z.object({ kind: z.literal("skip") }),
]);

export async function placeholderRedPlayDecision(
  state: GameState,
  playerId: PlayerId,
): Promise<PlaceholderRedPlayDecision> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the Red player. Decide whether to play a signaled card or skip based on the current game state." },
      { role: "user", content: JSON.stringify({ state, playerId }) },
    ],
    text: {
      format: zodTextFormat(PlayDecisionSchema, "play_decision"),
    },
  });
  return response.output_parsed as PlaceholderRedPlayDecision;
}

const SequenceDecisionSchema = z.object({
  sequence: z.array(PlayerIdSchema),
});

export async function placeholderRedSequenceDecision(state: GameState): Promise<PlayerId[]> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the White Cell. Decide the turn sequence for the Red players based on the current game state." },
      { role: "user", content: JSON.stringify({ state }) },
    ],
    text: {
      format: zodTextFormat(SequenceDecisionSchema, "sequence_decision"),
    },
  });
  return response.output_parsed!.sequence;
}

const SummarySchema = z.object({ summary: z.string() });

export async function placeholderWhiteCellSummary(
  kind: "game_start" | "state_of_world",
  turn: number,
  state: GameState,
): Promise<string> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: `You are the White Cell. Summarize the ${kind} for turn ${turn}.` },
      { role: "user", content: JSON.stringify({ state, kind, turn }) },
    ],
    text: {
      format: zodTextFormat(SummarySchema, "summary"),
    },
  });
  return response.output_parsed!.summary;
}

const ResolutionSchema = z.object({ resolution: z.string() });

export async function placeholderWhiteCellAdjudicationResolution(
  request: AdjudicationRequest,
  state: GameState,
): Promise<string> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the White Cell. Resolve the adjudication request in rules-engine-compatible terms." },
      { role: "user", content: JSON.stringify({ state, request }) },
    ],
    text: {
      format: zodTextFormat(ResolutionSchema, "resolution"),
    },
  });
  return response.output_parsed!.resolution;
}

const EventNoteSchema = z.object({ note: z.string() });

export async function placeholderWhiteCellEventNote(cardId: CardId, state: GameState): Promise<string> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the White Cell. Decide why and how to inject a scenario event for the given card ID." },
      { role: "user", content: JSON.stringify({ state, cardId }) },
    ],
    text: {
      format: zodTextFormat(EventNoteSchema, "event_note"),
    },
  });
  return response.output_parsed!.note;
}

const EventDecisionSchema = z.object({ cardId: CardIdSchema.optional() });

export async function placeholderWhiteCellEventDecision(
  state: GameState,
): Promise<CardId | undefined> {
  const response = await openai.responses.parse({
    model: "gpt-5.4-nano",
    input: [
      { role: "system", content: "You are the White Cell. Decide whether to inject an event and which event to use." },
      { role: "user", content: JSON.stringify({ state }) },
    ],
    text: {
      format: zodTextFormat(EventDecisionSchema, "event_decision"),
    },
  });
  return response.output_parsed!.cardId;
}
