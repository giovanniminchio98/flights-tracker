/** Automatic flight-detail lookup via AeroDataBox (through RapidAPI), for
 * flight numbers you haven't logged before and therefore have no history
 * to draw a route from. This is a genuine third-party flight-data API —
 * a deliberate exception to the app's original "no flight APIs" design,
 * requested explicitly because typing routes/times by hand for a new
 * flight number is otherwise unavoidable without one.
 *
 * Caveat this module can't paper over: there is no backend here, so the
 * API key is sent straight from the browser and is visible to anyone who
 * opens DevTools on the deployed page. Fine for a personal key on a small
 * free tier; not something to reuse for anything more sensitive.
 *
 * Note: this integration was written from AeroDataBox's documented
 * response shape, not verified against a live call (no key, and no
 * network path to RapidAPI from the build environment). If the parsing
 * below doesn't match what your key actually returns, share a sample
 * response and it can be corrected quickly.
 */

const API_HOST = "aerodatabox.p.rapidapi.com";

export interface FlightLookupResult {
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO 8601
  arrivalTime: string; // ISO 8601
}

interface AeroDataBoxAirport {
  iata?: string;
}

interface AeroDataBoxScheduledTime {
  utc?: string;
}

interface AeroDataBoxLeg {
  airport?: AeroDataBoxAirport;
  scheduledTime?: AeroDataBoxScheduledTime;
}

interface AeroDataBoxFlight {
  departure?: AeroDataBoxLeg;
  arrival?: AeroDataBoxLeg;
  airline?: { name?: string };
}

function parseAeroDataBoxTime(raw: string): string {
  // AeroDataBox commonly formats UTC times like "2024-01-01 10:00Z"
  // (a space instead of "T") — normalize before handing to Date.
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Couldn't parse the timestamp AeroDataBox returned ("${raw}").`);
  }
  return date.toISOString();
}

/** Looks up a flight number's scheduled route/times for a given local
 * date (YYYY-MM-DD, e.g. from a native <input type="date">). Throws a
 * user-presentable Error on any failure — missing key, bad key, quota,
 * no match, unexpected response shape, or network/CORS failure — so the
 * caller can fall back to manual entry with a clear reason shown. */
export async function lookupFlight(
  flightNumber: string,
  dateStr: string,
  apiKey: string
): Promise<FlightLookupResult> {
  const url = `https://${API_HOST}/flights/number/${encodeURIComponent(flightNumber)}/${dateStr}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": API_HOST,
      },
    });
  } catch {
    throw new Error("Couldn't reach AeroDataBox — network error, or the request was blocked by CORS.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("AeroDataBox rejected the API key — check it's correct and subscribed to a plan.");
  }
  if (res.status === 429) {
    throw new Error("AeroDataBox quota reached for this key.");
  }
  if (res.status === 404) {
    throw new Error(`No scheduled flight found for ${flightNumber} on ${dateStr}.`);
  }
  if (!res.ok) {
    throw new Error(`AeroDataBox lookup failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as AeroDataBoxFlight | AeroDataBoxFlight[];
  const flights = Array.isArray(data) ? data : [data];
  if (flights.length === 0) {
    throw new Error(`No scheduled flight found for ${flightNumber} on ${dateStr}.`);
  }

  const flight = flights[0];
  const departureAirport = flight.departure?.airport?.iata;
  const arrivalAirport = flight.arrival?.airport?.iata;
  const departureTimeRaw = flight.departure?.scheduledTime?.utc;
  const arrivalTimeRaw = flight.arrival?.scheduledTime?.utc;

  if (!departureAirport || !arrivalAirport || !departureTimeRaw || !arrivalTimeRaw) {
    throw new Error("AeroDataBox's response didn't include the expected route/time fields.");
  }

  return {
    airline: flight.airline?.name ?? "",
    departureAirport: departureAirport.toUpperCase(),
    arrivalAirport: arrivalAirport.toUpperCase(),
    departureTime: parseAeroDataBoxTime(departureTimeRaw),
    arrivalTime: parseAeroDataBoxTime(arrivalTimeRaw),
  };
}
