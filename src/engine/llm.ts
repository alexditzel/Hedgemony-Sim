import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
import { getPlayerDeck, getPlayersBySide, getRedChoiceOptions } from "./rules";
import type {
  AdjudicationRequest,
  CardId,
  GameState,
  PlayerId,
  RedSignalState,
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

export type PlaceholderRedPlayDecision =
  | { kind: "play"; cardId: CardId }
  | { kind: "skip" };

export function placeholderRedSignalDecision(
  state: GameState,
  playerId: PlayerId,
): PlaceholderRedSignalDecision {
  const deck = getPlayerDeck(state, playerId);
  const action = deck.find((card) => card.type === "Action");
  const investment = deck.find((card) => card.type === "Investment");
  const cardIds = [action, investment, ...deck]
    .filter((card): card is NonNullable<typeof card> => Boolean(card))
    .map((card) => card.id)
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .slice(0, 3);

  // Placeholder for a future Red-player LLM request that will choose signaled cards and write the intelligence brief.
  return {
    cardIds,
    briefSummary: `${playerId} placeholder LLM signal brief.`,
    activationIntent: Object.fromEntries(
      cardIds.map((id) => [id, "Undeclared"]),
    ),
  };
}

export function placeholderRedPlayDecision(
  state: GameState,
  playerId: PlayerId,
): PlaceholderRedPlayDecision {
  const options = getRedChoiceOptions(state, playerId);
  const alreadyPlayed = state.red_plays[playerId]?.played_card_ids.length ?? 0;
  if (alreadyPlayed > 0 && options.canSkip) {
    // Placeholder for a future Red-player LLM request that will decide whether to stop after legal played-card mix is achieved.
    return { kind: "skip" };
  }
  const nextCard = options.remaining[0];
  if (nextCard) {
    // Placeholder for a future Red-player LLM request that will select which remaining signaled card to play.
    return { kind: "play", cardId: nextCard.id };
  }
  // Placeholder for a future Red-player LLM request that will decide to pass when no playable Red card remains.
  return { kind: "skip" };
}

export function placeholderRedSequenceDecision(state: GameState): PlayerId[] {
  // Placeholder for a future White Cell LLM request that will choose the Red player action sequence.
  return getPlayersBySide(state, "Red").map((player) => player.id);
}

export function placeholderWhiteCellSummary(
  kind: "game_start" | "state_of_world",
  turn: number,
): string {
  // Placeholder for a future White Cell LLM request that will summarize relevant world-state changes.
  return kind === "game_start"
    ? "Placeholder White Cell opening state-of-world summary."
    : `Placeholder White Cell state-of-world summary for turn ${turn}.`;
}

export function placeholderWhiteCellAdjudicationResolution(
  request: AdjudicationRequest,
): string {
  // Placeholder for a future White Cell LLM request that will resolve adjudications in rules-engine-compatible terms.
  if (
    typeof request.payload === "object" &&
    request.payload !== null &&
    !Array.isArray(request.payload) &&
    request.payload.kind === "table_extension"
  ) {
    return "0";
  }
  return "Placeholder White Cell adjudication resolution.";
}

export function placeholderWhiteCellEventNote(cardId: CardId): string {
  // Placeholder for a future White Cell LLM request that will decide why and how to inject a scenario event.
  return `Placeholder White Cell event injection for ${cardId}.`;
}

export function placeholderWhiteCellEventDecision(
  state: GameState,
): CardId | undefined {
  // Placeholder for a future White Cell LLM request that will decide whether to inject an event and which event to use.
  return Object.values(state.cards).find(
    (card) =>
      card.type === "InternationalEvent" || card.type === "DomesticEvent",
  )?.id;
}
