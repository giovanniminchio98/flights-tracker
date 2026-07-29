import { lookupAirline } from "./airlines";
import { isKnownAirport } from "./airports";
import type { FlightCandidate, RawCalendarEvent } from "@/types";

const KEYWORD_PATTERN =
  /\b(flight|boarding pass|e-?ticket|pnr|confirmation code|confirmation number|booking reference|record locator|check-?in|itinerary)\b/i;

// Airline code (2 alphanumeric chars, at least one letter) + 2-4 digit flight number,
// e.g. "AY1234", "AY 1234", "9W-123".
const FLIGHT_NUMBER_PATTERN = /\b([A-Z][A-Z0-9]|[0-9][A-Z])[\s-]?(\d{2,4})\b/;

const CONFIRMATION_PATTERN =
  /(?:confirmation(?:\s*(?:code|number|#))?|pnr|record locator|booking reference)\s*[:#]?\s*([A-Z0-9]{5,8})\b/i;

const AIRPORT_CODE_PATTERN = /\b([A-Z]{3})\b/g;

// Airline/booking domains that hint an event was generated from a flight
// confirmation email even when eventType metadata isn't populated.
const AIRLINE_MARKER_PATTERN =
  /(airline|flight|booking\.com|expedia|kayak|e-?ticket|itinerary)/i;

function normalizeFlightNumber(code: string, digits: string): string {
  return `${code.toUpperCase()}${digits}`;
}

function looksLikeFlight(event: RawCalendarEvent): {
  isCandidate: boolean;
  flightNumberMatch: RegExpMatchArray | null;
} {
  const text = `${event.summary}\n${event.description}\n${event.location}`;

  if (event.googleEventType === "flight") {
    return { isCandidate: true, flightNumberMatch: text.match(FLIGHT_NUMBER_PATTERN) };
  }

  const flightNumberMatch = text.match(FLIGHT_NUMBER_PATTERN);
  const keywordMatch = KEYWORD_PATTERN.test(text);
  const markerMatch =
    (event.iCalUID && AIRLINE_MARKER_PATTERN.test(event.iCalUID)) ||
    (event.sourceUrl && AIRLINE_MARKER_PATTERN.test(event.sourceUrl));

  const isCandidate = Boolean(flightNumberMatch) || keywordMatch || Boolean(markerMatch);
  return { isCandidate, flightNumberMatch };
}

function extractAirports(event: RawCalendarEvent): { departureAirport: string; arrivalAirport: string } {
  const text = `${event.location}\n${event.summary}\n${event.description}`;

  // Prefer an explicit "XXX to YYY" / "XXX-YYY" / "XXX -> YYY" pattern between known airports.
  const routePattern = /\b([A-Z]{3})\b[^A-Za-z0-9]{0,20}?(?:to|-|→|>)[^A-Za-z0-9]{0,20}?\b([A-Z]{3})\b/;
  const routeMatch = text.match(routePattern);
  if (routeMatch && isKnownAirport(routeMatch[1]) && isKnownAirport(routeMatch[2])) {
    return { departureAirport: routeMatch[1], arrivalAirport: routeMatch[2] };
  }

  // Fall back to the first two distinct known-airport codes in order of appearance.
  const found: string[] = [];
  let match: RegExpExecArray | null;
  AIRPORT_CODE_PATTERN.lastIndex = 0;
  while ((match = AIRPORT_CODE_PATTERN.exec(text)) !== null) {
    const code = match[1];
    if (isKnownAirport(code) && !found.includes(code)) {
      found.push(code);
    }
    if (found.length === 2) break;
  }

  return {
    departureAirport: found[0] ?? "",
    arrivalAirport: found[1] ?? "",
  };
}

/** Parses a raw calendar event (from either Google Calendar or a parsed
 * iCloud .ics file) into a structured flight candidate, using shared text
 * heuristics. Returns null if the event doesn't look like a flight. */
export function parseFlightCandidate(event: RawCalendarEvent): FlightCandidate | null {
  const { isCandidate, flightNumberMatch } = looksLikeFlight(event);
  if (!isCandidate) return null;

  const text = `${event.summary}\n${event.description}\n${event.location}`;

  let flightNumber = "";
  let airlineCode = "";
  if (flightNumberMatch) {
    airlineCode = flightNumberMatch[1].toUpperCase();
    flightNumber = normalizeFlightNumber(flightNumberMatch[1], flightNumberMatch[2]);
  }

  // Without a parseable flight number we can't build a reliable dedupe key,
  // so treat the event as not-a-flight rather than storing a garbage row.
  if (!flightNumber) return null;

  const confirmationMatch = text.match(CONFIRMATION_PATTERN);
  const confirmationCode = confirmationMatch ? confirmationMatch[1].toUpperCase() : "";

  const { departureAirport, arrivalAirport } = extractAirports(event);

  return {
    source: event.source,
    sourceEventId: event.eventId,
    flightNumber,
    airline: lookupAirline(airlineCode),
    confirmationCode,
    departureAirport,
    arrivalAirport,
    departureTime: event.start,
    arrivalTime: event.end,
  };
}
