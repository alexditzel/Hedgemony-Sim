import type { Location, PlayerId } from "../engine";

export type Coordinates = [number, number];

type MapToken = {
  locationId: string;
  owner: PlayerId;
};

const OWNER_LOCATION_COORDINATES: Record<string, Coordinates> = {
  "US:INDOPACOM_PRC": [21.3069, -157.8583],
  "US:INDOPACOM_DPRK": [36.9622, 127.0311],
  "US:EUCOM_RU": [52.51, 13.4049],
  "US:CENTCOM_AFGHANISTAN": [25.2532, 55.3657],
  "US:CENTCOM_IRAQ": [29.2266, 47.9689],
  "NATO_EU:EUCOM_RU": [52.2297, 21.0122],
  "NATO_EU:EUCOM_NATO": [50.8798, 4.7005]
};

export function resolveMapCoordinates(token: MapToken, location?: Location): Coordinates | undefined {
  return OWNER_LOCATION_COORDINATES[`${token.owner}:${token.locationId}`] ?? location?.coordinates;
}

export function offsetCoordinates(coords: Coordinates, offsetIndex: number): Coordinates {
  if (offsetIndex <= 0) return coords;
  return [coords[0] + offsetIndex * 0.7, coords[1] + offsetIndex * 0.7];
}
