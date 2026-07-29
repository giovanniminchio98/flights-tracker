import type { FlightCandidate, FlightRecord, SyncSummary } from "@/types";
import type { SheetRow } from "./googleSheets";
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

function eventToken(source: string, sourceEventId: string): string {
  return `${source}:${sourceEventId}`;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function joinCsv(values: Iterable<string>): string {
  return Array.from(new Set(values)).join(",");
}

export interface MergePlan {
  toAppend: FlightRecord[];
  toUpdate: { rowNumber: number; record: FlightRecord }[];
  summary: Pick<SyncSummary, "newFlights" | "updatedFlights" | "duplicatesSkipped">;
}

/** Merges freshly parsed flight candidates (from Google + iCloud) into the
 * existing sheet rows, applying the cross-source dedupe rules:
 *  - secondary key (source:eventId) skip: this exact calendar event was
 *    already synced before, nothing to do.
 *  - primary key (flightNumber + departure date): the same real-world
 *    flight, whichever source it came from. Merges into the existing row
 *    (filling blanks, refreshing times, unioning linkedEventIds/sources)
 *    instead of creating a duplicate row. */
export function mergeCandidates(candidates: FlightCandidate[], existingRows: SheetRow[]): MergePlan {
  const now = new Date().toISOString();

  const byId = new Map<string, { rowNumber?: number; record: FlightRecord }>();
  const linkedTokens = new Set<string>();
  for (const row of existingRows) {
    byId.set(row.record.id, { rowNumber: row.rowNumber, record: { ...row.record } });
    for (const token of splitCsv(row.record.linkedEventIds)) linkedTokens.add(token);
  }

  const newIds = new Set<string>();
  const updatedIds = new Set<string>();
  let duplicatesSkipped = 0;

  for (const candidate of candidates) {
    const token = eventToken(candidate.source, candidate.sourceEventId);
    if (linkedTokens.has(token)) {
      duplicatesSkipped++;
      continue;
    }
    linkedTokens.add(token);

    const id = computeFlightId(candidate.flightNumber, candidate.departureTime);
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, {
        record: {
          id,
          flightNumber: candidate.flightNumber,
          airline: candidate.airline,
          confirmationCode: candidate.confirmationCode,
          departureAirport: candidate.departureAirport,
          arrivalAirport: candidate.arrivalAirport,
          departureTime: candidate.departureTime,
          arrivalTime: candidate.arrivalTime,
          linkedEventIds: token,
          sources: candidate.source,
          lastSyncedAt: now,
        },
      });
      newIds.add(id);
      continue;
    }

    const r = existing.record;
    const merged: FlightRecord = {
      ...r,
      airline: r.airline || candidate.airline,
      confirmationCode: r.confirmationCode || candidate.confirmationCode,
      departureAirport: r.departureAirport || candidate.departureAirport,
      arrivalAirport: r.arrivalAirport || candidate.arrivalAirport,
      departureTime: candidate.departureTime || r.departureTime,
      arrivalTime: candidate.arrivalTime || r.arrivalTime,
      linkedEventIds: joinCsv([...splitCsv(r.linkedEventIds), token]),
      sources: joinCsv([...splitCsv(r.sources), candidate.source]),
      lastSyncedAt: now,
    };
    existing.record = merged;
    if (!newIds.has(id)) updatedIds.add(id);
  }

  const toAppend: FlightRecord[] = [];
  const toUpdate: { rowNumber: number; record: FlightRecord }[] = [];

  for (const [id, entry] of byId) {
    if (newIds.has(id)) {
      toAppend.push(entry.record);
    } else if (updatedIds.has(id) && entry.rowNumber) {
      toUpdate.push({ rowNumber: entry.rowNumber, record: entry.record });
    }
  }

  return {
    toAppend,
    toUpdate,
    summary: {
      newFlights: newIds.size,
      updatedFlights: updatedIds.size,
      duplicatesSkipped,
    },
  };
}
