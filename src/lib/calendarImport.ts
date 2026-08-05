import type { FlightCandidate, FlightRecord, RawCalendarEvent } from "@/types";
import { parseFlightCandidate } from "./flightParser";
import { fetchGoogleCalendarEvents } from "./googleCalendar";
import { parseIcsToEvents } from "./icsParser";
import { computeFlightId } from "./dedupe";
import { getFlights, replaceAllFlights, getTombstones } from "./localFlightStore";
import { pruneTombstones } from "./mergeFlights";

/** Turns calendar events (Google, or an iCloud/Apple .ics export) into flight
 * records, skipping anything already logged. Import never overwrites what the
 * user has: an event matching an existing flight is reported as a duplicate
 * and left alone, so hand-entered details survive re-imports. */

export interface ImportResult {
  /** Events that looked like flights and were new. */
  added: FlightRecord[];
  /** Already-logged flights, by "AY1234 · 12 Mar 2026". */
  duplicates: string[];
  /** How many calendar entries were scanned in total. */
  eventsScanned: number;
  /** Flight-looking events we couldn't parse into a usable record. */
  unparsed: number;
}

function describe(c: FlightCandidate): string {
  const date = c.departureTime.slice(0, 10);
  return `${c.flightNumber} · ${date}`;
}

/** Shared core: candidates → local store, with dedupe accounting. */
function applyCandidates(candidates: FlightCandidate[], eventsScanned: number, unparsed: number): ImportResult {
  const existing = getFlights();
  const existingIds = new Set(existing.map((f) => f.id));

  const added: FlightRecord[] = [];
  const duplicates: string[] = [];
  const now = new Date().toISOString();

  for (const c of candidates) {
    const id = computeFlightId(c.flightNumber, c.departureTime);
    if (existingIds.has(id)) {
      duplicates.push(describe(c));
      continue;
    }
    existingIds.add(id);
    added.push({
      id,
      flightNumber: c.flightNumber,
      airline: c.airline,
      confirmationCode: c.confirmationCode,
      departureAirport: c.departureAirport,
      arrivalAirport: c.arrivalAirport,
      departureTime: c.departureTime,
      arrivalTime: c.arrivalTime,
      linkedEventIds: `${c.source}:${c.sourceEventId}`,
      sources: c.source,
      lastSyncedAt: now,
    });
  }

  if (added.length > 0) {
    replaceAllFlights([...existing, ...added], pruneTombstones(getTombstones()));
  }

  return { added, duplicates, eventsScanned, unparsed };
}

function candidatesFrom(events: RawCalendarEvent[]): { candidates: FlightCandidate[]; unparsed: number } {
  const candidates: FlightCandidate[] = [];
  let unparsed = 0;
  for (const event of events) {
    const parsed = parseFlightCandidate(event);
    if (parsed) candidates.push(parsed);
    else if (looksFlightish(event)) unparsed++;
  }
  return { candidates, unparsed };
}

/** Only counts as "missed" if it mentions flying — otherwise every dentist
 * appointment would inflate the unparsed tally. */
function looksFlightish(e: RawCalendarEvent): boolean {
  const text = `${e.summary} ${e.description}`.toLowerCase();
  return /\bflight\b|\bboarding\b|\bdeparture\b|✈/.test(text);
}

/** Imports from every Google Calendar the signed-in user can read. */
export async function importFromGoogleCalendar(accessToken: string): Promise<ImportResult> {
  const events = await fetchGoogleCalendarEvents(accessToken);
  const { candidates, unparsed } = candidatesFrom(events);
  return applyCandidates(candidates, events.length, unparsed);
}

/** Imports from an .ics file exported from Apple/iCloud Calendar.
 *
 * Apple publishes no browser-reachable calendar API — CloudKit web services
 * need a paid developer account and CalDAV can't be called cross-origin — so
 * a file export is the one route that works from a static site with no
 * backend and no credentials to store. */
export function importFromIcs(icsText: string): ImportResult {
  const events = parseIcsToEvents(icsText);
  const { candidates, unparsed } = candidatesFrom(events);
  return applyCandidates(candidates, events.length, unparsed);
}
