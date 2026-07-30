import airportsData from "@/data/airports.json";

export interface AirportInfo {
  name: string;
  city: string;
  country: string;
  continent: string;
  lat: number;
  lon: number;
  tz: string;
}

interface RawAirport {
  name: string;
  country: string;
  continent: string;
  lat: number;
  lon: number;
  tz: string;
}

const RAW = airportsData as Record<string, RawAirport>;

/** Full IATA airport dataset (~5,900 airports with scheduled service or
 * medium/large type), bundled at build time from OurAirports via
 * scripts/gen-airports.mjs — no runtime API. This replaces the earlier
 * ~120-airport hand-curated list, which was the root cause of the map not
 * rendering and miles reading 0 whenever a flight used an airport outside
 * that short list. */
export function getAirport(code: string): AirportInfo | null {
  const raw = RAW[code.toUpperCase()];
  if (!raw) return null;
  return {
    name: raw.name,
    // The dataset carries a full airport name, not a separate city; derive a
    // short label by trimming the common "… Airport"/"International" suffixes.
    city: raw.name.replace(/\s+(International|Intl\.?|Regional|Municipal)?\s*Airport$/i, "").trim() || raw.name,
    country: raw.country,
    continent: raw.continent,
    lat: raw.lat,
    lon: raw.lon,
    tz: raw.tz,
  };
}

/** Back-compat proxy: existing code reads AIRPORTS[code]. Returns undefined
 * for unknown codes, matching the old plain-object behavior. */
export const AIRPORTS: Record<string, AirportInfo> = new Proxy(
  {},
  {
    get: (_t, prop: string) => getAirport(prop) ?? undefined,
    has: (_t, prop: string) => typeof prop === "string" && prop.toUpperCase() in RAW,
  }
) as Record<string, AirportInfo>;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres between two IATA codes, or null if
 * either code is unknown. Kilometres is the app's internal canonical unit;
 * the UI converts to miles per the user's preference. */
export function distanceKm(from: string, to: string): number | null {
  const a = getAirport(from);
  const b = getAirport(to);
  if (!a || !b) return null;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_KM * c);
}

/** Great-circle distance in statute miles, or null if either code is unknown. */
export function distanceMiles(from: string, to: string): number | null {
  const km = distanceKm(from, to);
  return km == null ? null : Math.round(km * 0.621371);
}

export function isKnownAirport(code: string): boolean {
  return code.toUpperCase() in RAW;
}

export function getContinent(codeOrCountry: string): string | null {
  // Accept an airport code (preferred — continent is per-airport in the data).
  const airport = getAirport(codeOrCountry);
  if (airport) return airport.continent || null;
  return null;
}

export function getCountry(code: string): string | null {
  return getAirport(code)?.country ?? null;
}
