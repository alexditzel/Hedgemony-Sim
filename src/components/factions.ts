import type { GameState, PlayerId, PlayerSide } from "../engine";

export type FactionTone = "blue" | "red" | "white" | "neutral";

export function sideToTone(side: PlayerSide | "WhiteCell" | undefined): FactionTone {
  if (side === "Blue") return "blue";
  if (side === "Red") return "red";
  if (side === "Other" || side === "WhiteCell") return "white";
  return "neutral";
}

export function playerTone(state: GameState, playerId: PlayerId | "WhiteCell" | undefined): FactionTone {
  if (!playerId) return "neutral";
  if (playerId === "WhiteCell") return "white";
  const player = state.players[playerId];
  return sideToTone(player?.side);
}

export function playerLabel(state: GameState, playerId: PlayerId | "WhiteCell" | undefined): string {
  if (!playerId) return "—";
  if (playerId === "WhiteCell") return "White Cell";
  return state.players[playerId]?.label ?? playerId;
}

export const PHASE_LABELS: Record<string, string> = {
  GameStart: "Game Start",
  RedSignaling: "Red Signaling",
  BlueReadinessBill: "Blue Readiness Bill",
  BlueInvestmentsAndActions: "Blue Investments & Actions",
  RedInvestmentsAndActions: "Red Investments & Actions",
  AnnualResourcesAllocation: "Annual Resources Allocation",
  StateOfWorldSummary: "State of World",
  GameOver: "Game Over"
};

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}
