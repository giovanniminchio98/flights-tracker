import { stableHash } from "./hash";

function departureDate(isoTime: string): string {
  return isoTime.slice(0, 10); // YYYY-MM-DD
}

/** Deterministic primary dedupe key: the same real-world flight, regardless
 * of which calendar/source it was found in, always hashes to the same id. */
export function primaryDedupeKey(flightNumber: string, isoDepartureTime: string): string {
  return `${flightNumber.toUpperCase()}|${departureDate(isoDepartureTime)}`;
}

export function computeFlightId(flightNumber: string, isoDepartureTime: string): string {
  return stableHash(primaryDedupeKey(flightNumber, isoDepartureTime));
}
