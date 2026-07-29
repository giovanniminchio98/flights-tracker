import { fetchGoogleCalendarEvents } from "./googleCalendar";
import { parseFlightCandidate } from "./flightParser";
import {
  ensureSpreadsheet,
  readFlightRows,
  appendFlightRows,
  updateFlightRow,
  deleteFlightRow,
} from "./googleSheets";
import { mergeCandidates, computeFlightId } from "./dedupe";
import { computeStats, type FlightStats } from "./stats";
import { lookupAirline } from "./airlines";
import type { FlightCandidate, FlightRecord, RawCalendarEvent, SyncSummary } from "@/types";

async function applyCandidates(accessToken: string, candidates: FlightCandidate[]): Promise<SyncSummary> {
  const { spreadsheetId } = await ensureSpreadsheet(accessToken);
  const existingRows = await readFlightRows(accessToken, spreadsheetId);
  const plan = mergeCandidates(candidates, existingRows);

  await appendFlightRows(accessToken, spreadsheetId, plan.toAppend);
  for (const { rowNumber, record } of plan.toUpdate) {
    await updateFlightRow(accessToken, spreadsheetId, rowNumber, record);
  }

  return {
    ...plan.summary,
    googleEventsScanned: 0,
    icloudEventsScanned: 0,
    errors: [],
  };
}

function extractCandidates(events: RawCalendarEvent[]): FlightCandidate[] {
  const candidates: FlightCandidate[] = [];
  for (const event of events) {
    const candidate = parseFlightCandidate(event);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

/** Pulls events from every Google calendar, runs the flight heuristics, and
 * dedupes the result into the Sheet. */
export async function runGoogleSync(accessToken: string): Promise<SyncSummary> {
  const events = await fetchGoogleCalendarEvents(accessToken);
  const summary = await applyCandidates(accessToken, extractCandidates(events));
  return { ...summary, googleEventsScanned: events.length };
}

/** Runs the same heuristics/dedupe over events already parsed from an
 * uploaded/pasted iCloud .ics export. */
export async function runIcsImport(accessToken: string, events: RawCalendarEvent[]): Promise<SyncSummary> {
  const summary = await applyCandidates(accessToken, extractCandidates(events));
  return { ...summary, icloudEventsScanned: events.length };
}

export async function loadFlights(
  accessToken: string
): Promise<{ spreadsheetId: string; flights: FlightRecord[]; stats: FlightStats }> {
  const { spreadsheetId } = await ensureSpreadsheet(accessToken);
  const rows = await readFlightRows(accessToken, spreadsheetId);
  const flights = rows.map((r) => r.record);
  return { spreadsheetId, flights, stats: computeStats(flights) };
}

export interface ManualFlightInput {
  flightNumber: string;
  airline?: string;
  confirmationCode?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
}

/** Adds (or merges into an existing matching row) a flight entered by hand
 * from the dashboard — the fallback for flights that weren't auto-detected. */
export async function addManualFlight(accessToken: string, input: ManualFlightInput): Promise<FlightRecord> {
  const flightNumber = input.flightNumber.toUpperCase().replace(/\s+/g, "");
  const airlineCode = flightNumber.match(/^[A-Z0-9]{2}/)?.[0] ?? "";
  const id = computeFlightId(flightNumber, input.departureTime);
  const now = new Date().toISOString();

  const { spreadsheetId } = await ensureSpreadsheet(accessToken);
  const rows = await readFlightRows(accessToken, spreadsheetId);
  const existing = rows.find((r) => r.record.id === id);

  if (existing) {
    const r = existing.record;
    const merged: FlightRecord = {
      ...r,
      airline: r.airline || input.airline || lookupAirline(airlineCode),
      confirmationCode: r.confirmationCode || input.confirmationCode || "",
      departureAirport: r.departureAirport || input.departureAirport.toUpperCase(),
      arrivalAirport: r.arrivalAirport || input.arrivalAirport.toUpperCase(),
      arrivalTime: r.arrivalTime || input.arrivalTime,
      sources: Array.from(new Set([...r.sources.split(",").filter(Boolean), "manual"])).join(","),
      lastSyncedAt: now,
    };
    await updateFlightRow(accessToken, spreadsheetId, existing.rowNumber, merged);
    return merged;
  }

  const record: FlightRecord = {
    id,
    flightNumber,
    airline: input.airline || lookupAirline(airlineCode),
    confirmationCode: input.confirmationCode ?? "",
    departureAirport: input.departureAirport.toUpperCase(),
    arrivalAirport: input.arrivalAirport.toUpperCase(),
    departureTime: input.departureTime,
    arrivalTime: input.arrivalTime,
    linkedEventIds: "",
    sources: "manual",
    lastSyncedAt: now,
  };
  await appendFlightRows(accessToken, spreadsheetId, [record]);
  return record;
}

export async function deleteFlight(accessToken: string, spreadsheetId: string, flightId: string): Promise<void> {
  const rows = await readFlightRows(accessToken, spreadsheetId);
  const row = rows.find((r) => r.record.id === flightId);
  if (!row) throw new Error("Flight not found");
  await deleteFlightRow(accessToken, spreadsheetId, row.rowNumber);
}
