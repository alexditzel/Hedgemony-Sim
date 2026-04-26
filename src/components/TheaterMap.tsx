import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { GameState, PlayerId } from "../engine";
import { sideToTone } from "./factions";
import { offsetCoordinates, resolveMapCoordinates } from "./mapCoordinates";
import { buildFfMarkerIcon, buildPopupHtml, type MarkerSide } from "./MapMarker";

interface TheaterMapProps {
  state: GameState;
}

interface AggregatedToken {
  locationId: string;
  owner: PlayerId;
  ownerLabel: string;
  ffs: number;
  side: MarkerSide;
  pinned: boolean;
}

function toneToSide(tone: ReturnType<typeof sideToTone>): MarkerSide {
  if (tone === "blue") return "blue";
  if (tone === "red") return "red";
  return "neutral";
}

export function TheaterMap({ state }: TheaterMapProps) {
  const tokens: AggregatedToken[] = useMemo(() => {
    const map = new Map<string, AggregatedToken>();
    for (const force of Object.values(state.forces)) {
      const key = `${force.location_id}:${force.owner}`;
      const owner = state.players[force.owner];
      const side = toneToSide(sideToTone(owner?.side));
      const existing = map.get(key);
      if (existing) {
        existing.ffs += force.force_factors;
        existing.pinned = existing.pinned || force.pinned.active;
      } else {
        map.set(key, {
          locationId: force.location_id,
          owner: force.owner,
          ownerLabel: owner?.label ?? force.owner,
          ffs: force.force_factors,
          side,
          pinned: force.pinned.active
        });
      }
    }
    return Array.from(map.values());
  }, [state.forces, state.players]);

  return (
    <div className="theater-map">
      <MapContainer
        center={[25, 35]}
        zoom={2}
        minZoom={2}
        scrollWheelZoom
        className="theater-map__leaflet"
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {tokens.map((token, index) => {
          const location = state.locations[token.locationId];
          const coords = resolveMapCoordinates(token, location);
          if (!coords) return null;
          // small offset within a location so multiple owners don't overlap exactly
          const offsetIndex = ownerOffsetIndex(tokens, token);
          const lat = (coords[0] ?? 0) + offsetIndex * 0.7;
          const lng = coords[1] + offsetIndex * 0.7;
          const icon = buildFfMarkerIcon({
            owner: token.owner,
            ownerLabel: token.ownerLabel,
            ffs: token.ffs,
            side: token.side,
            pinned: token.pinned
          });
          return (
            <Marker
              key={`${token.locationId}-${token.owner}-${index}`}
              position={[lat, lng]}
              icon={icon}
            >
              <Popup className="ff-popup-wrap">
                <span dangerouslySetInnerHTML={{ __html: buildPopupHtml(state, location?.label ?? token.locationId, token.owner, token.ffs, token.pinned) }} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function ownerOffsetIndex(all: AggregatedToken[], token: AggregatedToken): number {
  const sameLoc = all.filter((entry) => entry.locationId === token.locationId);
  return sameLoc.findIndex((entry) => entry.owner === token.owner);
}
