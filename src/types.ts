export type FlightSource = "google" | "icloud" | "manual";

/** A raw calendar event, normalized enough for the parser to work on
 * regardless of whether it came from the Google Calendar API or a parsed
 * iCloud .ics file. */
export interface RawCalendarEvent {
  source: Exclude<FlightSource, "manual">;
  eventId: string;
  summary: string;
  description: string;
  location: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  /** Google-only: structured event type, when present. */
  googleEventType?: string;
  /** Google-only: iCalUID, sometimes carries airline markers. */
  iCalUID?: string;
  /** Google-only: source.url, sometimes points at an airline/booking domain. */
  sourceUrl?: string;
}

/** A flight candidate extracted from a calendar event by the parser. */
export interface FlightCandidate {
  source: Exclude<FlightSource, "manual">;
  sourceEventId: string;
  flightNumber: string; // normalized, e.g. "AY1234"
  airline: string;
  confirmationCode: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO 8601
  arrivalTime: string; // ISO 8601
}

/** A row as stored in / read from the Google Sheet. */
export interface FlightRecord {
  id: string;
  flightNumber: string;
  airline: string;
  confirmationCode: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  linkedEventIds: string; // comma-separated "source:eventId"
  sources: string; // comma-separated "google,icloud,manual"
  lastSyncedAt: string;
}

export interface SyncSummary {
  newFlights: number;
  updatedFlights: number;
  duplicatesSkipped: number;
  googleEventsScanned: number;
  icloudEventsScanned: number;
  errors: string[];
}
