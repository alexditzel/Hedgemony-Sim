import * as L from "leaflet";
import type { GameState, PlayerId } from "../engine";

export type MarkerSide = "blue" | "red" | "neutral";

export interface MarkerSpec {
  owner: PlayerId;
  ownerLabel: string;
  ffs: number;
  side: MarkerSide;
  pinned: boolean;
}

const FACTION_GLYPH: Record<string, string> = {
  US: "★",
  NATO_EU: "✪",
  RU: "▲",
  PRC: "■",
  DPRK: "◆",
  IR: "●"
};

function classFor(side: MarkerSide): string {
  return side === "red" ? "ff-marker--red" : side === "blue" ? "ff-marker--blue" : "ff-marker--neutral";
}

export function buildFfMarkerIcon(spec: MarkerSpec): L.DivIcon {
  const glyph = FACTION_GLYPH[spec.owner] ?? "▣";
  const code = shortOwner(spec.owner);
  const pinnedDot = spec.pinned ? '<i class="ff-marker__pin" aria-hidden></i>' : "";
  const html = `
    <div class="ff-marker ${classFor(spec.side)}" role="img" aria-label="${escape(spec.ownerLabel)} ${spec.ffs} force factors">
      ${pinnedDot}
      <span class="ff-marker__glyph" aria-hidden>${glyph}</span>
      <span class="ff-marker__count">${spec.ffs}</span>
      <span class="ff-marker__code">${code}</span>
    </div>
  `;
  return L.divIcon({
    className: "ff-marker-wrap",
    html,
    iconSize: [68, 30],
    iconAnchor: [34, 15]
  });
}

function shortOwner(id: PlayerId): string {
  if (id === "NATO_EU") return "NATO";
  if (id === "DPRK") return "DPRK";
  return id;
}

function escape(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildPopupHtml(state: GameState, locationLabel: string, owner: PlayerId, ffs: number, pinned: boolean): string {
  const player = state.players[owner];
  const sideLabel = player?.side ?? "—";
  return `
    <div class="ff-popup">
      <div class="ff-popup__head">
        <span class="ff-popup__pip ${player?.side === "Blue" ? "ff-popup__pip--blue" : player?.side === "Red" ? "ff-popup__pip--red" : ""}"></span>
        <span class="ff-popup__name">${escape(player?.label ?? owner)}</span>
      </div>
      <div class="ff-popup__row"><span>Force Factors</span><b>${ffs}</b></div>
      <div class="ff-popup__row"><span>Location</span><b>${escape(locationLabel)}</b></div>
      <div class="ff-popup__row"><span>Side</span><b>${escape(sideLabel)}</b></div>
      ${pinned ? '<div class="ff-popup__tag">Pinned</div>' : ""}
    </div>
  `;
}
