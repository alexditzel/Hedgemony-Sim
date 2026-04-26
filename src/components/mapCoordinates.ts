import type { Location, PlayerId } from "../engine";

export type Coordinates = { lat: number, lng: number };

type MapToken = {
  locationId: string;
  owner: PlayerId;
};

const OWNER_LOCATION_COORDINATES: Record<string, Coordinates> = {
  "US:INDOPACOM_PRC": { lat: 21.3069, lng: -157.8583 },
  "US:INDOPACOM_DPRK": { lat: 36.9622, lng: 127.0311 },
  "US:EUCOM_RU": { lat: 52.51, lng: 13.4049 },
  "US:CENTCOM_AFGHANISTAN": { lat: 25.2532, lng: 55.3657 },
  "US:CENTCOM_IRAQ": { lat: 29.2266, lng: 47.9689 },
  "NATO_EU:EUCOM_RU": { lat: 52.2297, lng: 21.0122 },
  "NATO_EU:EUCOM_NATO": { lat: 50.8798, lng: 4.700 },
};

export function resolveMapCoordinates(token: MapToken, location?: Location): Coordinates | undefined {
  return OWNER_LOCATION_COORDINATES[`${token.owner}:${token.locationId}`] ?? location?.coordinates;
}

export function offsetCoordinates(coords: Coordinates, offsetIndex: number): Coordinates {
  if (offsetIndex <= 0) return coords;
  return { lat: coords.lat + offsetIndex * 0.7, lng: coords.lng + offsetIndex * 0.7 }
}
