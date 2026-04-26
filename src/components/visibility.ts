import type { EventLogItem, GameState, PlayerId, RollRecord } from "../engine";

export type ViewerId = "Public" | "WhiteCell" | PlayerId;

export function canViewLog(entry: EventLogItem, viewer: ViewerId): boolean {
  if (entry.visibility === "public" || viewer === "WhiteCell") {
    return true;
  }
  return viewer !== "Public" && entry.player_id === viewer;
}

export function canViewRoll(roll: RollRecord, state: GameState, viewer: ViewerId): boolean {
  if (roll.visibility === "public" || viewer === "WhiteCell") {
    return true;
  }
  return (
    viewer !== "Public" &&
    state.event_log.some((entry) => entry.roll_id === roll.id && entry.player_id === viewer)
  );
}
