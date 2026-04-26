import type { ReactNode } from "react";
import type { GameState } from "../engine";
import { phaseLabel, playerLabel, playerTone } from "./factions";

export const COLOR_SCHEMES = [
  { id: "stealth-green", label: "Stealth Green" },
  { id: "deep-blue", label: "Deep Blue" },
  { id: "desert-sand", label: "Desert Sand" },
  { id: "charcoal-amber", label: "Charcoal & Amber" },
  { id: "slate-gray", label: "Slate Gray" },
  { id: "black-red", label: "Black & Red" },
  { id: "arctic-ice", label: "Arctic Ice" },
  { id: "night-ops", label: "Night Ops" },
  { id: "olive-drab", label: "Olive Drab" }
] as const;

export type ColorSchemeId = (typeof COLOR_SCHEMES)[number]["id"];

interface TopBarProps {
  state: GameState;
  onOpenMap?: () => void;
  advance?: ReactNode;
  colorScheme: ColorSchemeId;
  onColorSchemeChange: (scheme: ColorSchemeId) => void;
}

export function TopBar({ state, onOpenMap, advance, colorScheme, onColorSchemeChange }: TopBarProps) {
  const tone = playerTone(state, state.active_player_id ?? undefined);
  const pillClass =
    tone === "red" ? "topbar__active-side-pill--red" :
    tone === "blue" ? "topbar__active-side-pill--blue" :
    tone === "white" ? "topbar__active-side-pill--white" : "";
  const activeLabel = state.active_player_id ? playerLabel(state, state.active_player_id) : "Auto-resolving";
  return (
    <header className="topbar" role="banner">
      <div className="topbar__brand">
        <div className="topbar__brand-mark" aria-hidden />
        <div>
          <div className="topbar__brand-name">Hedgemony</div>
          <div className="topbar__brand-sub">Command · Blue Cell</div>
        </div>
      </div>
      <div className="topbar__phase">
        <div className="topbar__phase-block">
          <span className="topbar__phase-label">Turn / Max</span>
          <span className="topbar__phase-value">{state.turn} / {state.max_turns}</span>
        </div>
        <div className="topbar__phase-divider" aria-hidden />
        <div className="topbar__phase-block">
          <span className="topbar__phase-label">Phase</span>
          <span className="topbar__phase-value">{phaseLabel(state.phase)}{state.blue_subphase ? ` · ${state.blue_subphase}` : ""}</span>
        </div>
        <div className="topbar__phase-divider" aria-hidden />
        <div className="topbar__active">
          <span className="topbar__phase-label">Active</span>
          <span className={`topbar__active-side-pill ${pillClass}`}>{activeLabel}</span>
        </div>
        <div className="spacer" />
        {onOpenMap ? (
          <button type="button" className="topbar__map-btn" onClick={onOpenMap} aria-label="Open theater map">
            <span className="topbar__map-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
                <path d="M9 4v14" />
                <path d="M15 6v14" />
              </svg>
            </span>
            <span>Theater Map</span>
          </button>
        ) : null}
      </div>
      <div className="topbar__advance">
        <label className="topbar__scheme">
          <span className="topbar__scheme-label">Scheme</span>
          <select
            className="topbar__scheme-select"
            value={colorScheme}
            onChange={(event) => onColorSchemeChange(event.target.value as ColorSchemeId)}
            aria-label="Color scheme"
          >
            {COLOR_SCHEMES.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>{scheme.label}</option>
            ))}
          </select>
        </label>
        {advance}
      </div>
    </header>
  );
}
