import type { PlayerState } from "../engine";
import { sideToTone } from "./factions";

interface PlayerSwitcherProps {
  players: PlayerState[];
  activeId?: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}

export function PlayerSwitcher({ players, activeId, onSelect, ariaLabel = "Active player" }: PlayerSwitcherProps) {
  if (players.length === 0) return null;
  return (
    <div className="player-switcher" role="tablist" aria-label={ariaLabel}>
      {players.map((player) => {
        const tone = sideToTone(player.side);
        const isActive = player.id === activeId;
        return (
          <button
            key={player.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[
              "player-switcher__btn",
              isActive ? "player-switcher__btn--active" : "",
              tone === "red" ? "player-switcher__btn--red" : ""
            ].filter(Boolean).join(" ")}
            onClick={() => onSelect(player.id)}
          >
            {player.label}
          </button>
        );
      })}
    </div>
  );
}
