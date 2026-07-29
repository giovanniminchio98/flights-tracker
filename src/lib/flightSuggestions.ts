import type { FlightRecord } from "@/types";

export interface FlightSuggestion {
  flightNumber: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
}

/** Suggests flight numbers you've logged before that start with what's been
 * typed so far, most recently used first — there's no live flight-schedule
 * API to query, so this is the only real source of "did you mean this
 * route" hints. */
export function getFlightNumberSuggestions(query: string, flights: FlightRecord[]): FlightSuggestion[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const mostRecentByNumber = new Map<string, FlightRecord>();
  for (const f of flights) {
    if (!f.flightNumber.startsWith(q)) continue;
    const existing = mostRecentByNumber.get(f.flightNumber);
    if (!existing || f.lastSyncedAt > existing.lastSyncedAt) {
      mostRecentByNumber.set(f.flightNumber, f);
    }
  }

  return Array.from(mostRecentByNumber.values())
    .sort((a, b) => b.lastSyncedAt.localeCompare(a.lastSyncedAt))
    .slice(0, 5)
    .map((f) => ({
      flightNumber: f.flightNumber,
      airline: f.airline,
      departureAirport: f.departureAirport,
      arrivalAirport: f.arrivalAirport,
    }));
}
