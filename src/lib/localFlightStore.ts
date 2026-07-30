import type { FlightRecord } from "@/types";
import { computeFlightId } from "./dedupe";
import { lookupAirline } from "./airlines";

/** Baseline flight storage: entirely in the browser's localStorage, no
 * Google/iCloud connection required. This is the standalone mode — once
 * the Google Sheet sync is wired back in, it can take over as the source
 * of truth without changing the shape of a FlightRecord. */
const STORAGE_KEY = "flight-tracker:local-flights";

function readAll(): FlightRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FlightRecord[];
  } catch {
    return [];
  }
}

function writeAll(flights: FlightRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
}

export function getFlights(): FlightRecord[] {
  return readAll();
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

/** Adds a flight, or merges into an existing row with the same dedupe key
 * (flight number + departure date) — the same rule the Google/iCloud sync
 * uses, so entries added here won't duplicate once auto-sync comes back. */
export function addFlight(input: ManualFlightInput): FlightRecord {
  const flightNumber = input.flightNumber.toUpperCase().replace(/\s+/g, "");
  const airlineCode = flightNumber.match(/^[A-Z0-9]{2}/)?.[0] ?? "";
  const id = computeFlightId(flightNumber, input.departureTime);
  const now = new Date().toISOString();

  const flights = readAll();
  const idx = flights.findIndex((f) => f.id === id);

  if (idx >= 0) {
    const r = flights[idx];
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
    flights[idx] = merged;
    writeAll(flights);
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
  flights.push(record);
  writeAll(flights);
  return record;
}

export function deleteFlight(id: string): void {
  writeAll(readAll().filter((f) => f.id !== id));
}

const SAMPLE_SOURCE = "sample";

function iso(daysFromNow: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function hasSampleFlights(): boolean {
  return readAll().some((f) => f.sources.split(",").includes(SAMPLE_SOURCE));
}

/** Seeds two demo flights (one recent past, one upcoming within the weather
 * window) so the map and stats can be previewed without hand-entering data.
 * They're tagged `sample` so clearSampleFlights can remove exactly them,
 * leaving any real flights untouched. Dates are relative to now so the
 * upcoming one always shows an orange route + a live arrival forecast. */
export function loadSampleFlights(): void {
  const now = new Date().toISOString();
  const samples: FlightRecord[] = [
    {
      id: computeFlightId("AZ610", iso(-28, 10)),
      flightNumber: "AZ610",
      airline: "ITA Airways",
      confirmationCode: "DEMO01",
      departureAirport: "MXP",
      arrivalAirport: "JFK",
      departureTime: iso(-28, 10),
      arrivalTime: iso(-28, 18),
      linkedEventIds: "",
      sources: SAMPLE_SOURCE,
      lastSyncedAt: now,
    },
    {
      id: computeFlightId("BA478", iso(4, 8)),
      flightNumber: "BA478",
      airline: "British Airways",
      confirmationCode: "DEMO02",
      departureAirport: "LHR",
      arrivalAirport: "BCN",
      departureTime: iso(4, 8),
      arrivalTime: iso(4, 11),
      linkedEventIds: "",
      sources: SAMPLE_SOURCE,
      lastSyncedAt: now,
    },
  ];

  const existing = readAll().filter((f) => !f.sources.split(",").includes(SAMPLE_SOURCE));
  const existingIds = new Set(existing.map((f) => f.id));
  writeAll([...existing, ...samples.filter((s) => !existingIds.has(s.id))]);
}

export function clearSampleFlights(): void {
  writeAll(readAll().filter((f) => !f.sources.split(",").includes(SAMPLE_SOURCE)));
}
