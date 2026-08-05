import { getAirport } from "./airports";

/** Arrival-airport weather via Open-Meteo — free, no API key, CORS-enabled,
 * so it works from a static site with nothing for the user to configure.
 *
 * A single forecast call covers ~92 days back to ~16 days ahead; older
 * flights fall back to the historical archive. Anything further ahead than
 * the window returns null and the UI simply omits the weather line. */

// Open-Meteo's forecast endpoint covers a generous window in a *single*
// reliable call: up to 92 days into the past (measurements/reanalysis, no
// archive lag) and up to 16 days ahead. We use it for everything inside that
// window — which is where essentially every logged flight falls — and only
// reach for the separate historical archive for flights older than that.
const FORECAST_PAST_DAYS = 92;
const FORECAST_AHEAD_DAYS = 16;

export interface ArrivalWeather {
  tempC: number;
  code: number;
  label: string;
  emoji: string;
  isForecast: boolean; // false = historical
}

// WMO weather-interpretation codes → short label + emoji.
function describe(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "🌤️" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code <= 48) return { label: "Fog", emoji: "🌫️" };
  if (code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code <= 77) return { label: "Snow", emoji: "🌨️" };
  if (code <= 82) return { label: "Rain showers", emoji: "🌧️" };
  if (code <= 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Index of the hour nearest the target. `times` are unix seconds (UTC), so
 * the comparison is offset-free — no ambiguity from the airport's timezone. */
function pickHourIndex(times: number[], targetMs: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(times[i] * 1000 - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/** Fetches the weather at an arrival airport around the arrival time.
 * Returns null when the airport is unknown or the date is outside the
 * usable window (further than ~7 days ahead). Never throws — a failed
 * fetch just yields null so the UI degrades gracefully. */
export async function getArrivalWeather(
  arrivalCode: string,
  arrivalIso: string
): Promise<ArrivalWeather | null> {
  const airport = getAirport(arrivalCode);
  if (!airport) return null;

  const arrival = new Date(arrivalIso);
  if (Number.isNaN(arrival.getTime())) return null;

  const arrivalMs = arrival.getTime();
  const now = Date.now();
  const daysAhead = (arrivalMs - now) / 86400000;
  const isPast = arrivalMs < now;

  // Too far in the future to have any forecast signal.
  if (daysAhead > FORECAST_AHEAD_DAYS) return null;

  const { lat, lon } = airport;

  try {
    let url: string;
    if (daysAhead < -FORECAST_PAST_DAYS) {
      // Older than the forecast endpoint reaches back — use the historical
      // archive (single day around arrival).
      const dateStr = isoDate(arrival);
      url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weather_code&timeformat=unixtime`;
    } else {
      // One reliable call covering recent past → near future. Request just
      // enough days on each side of the arrival to bracket it.
      const past = isPast ? Math.min(FORECAST_PAST_DAYS, Math.ceil(-daysAhead) + 1) : 1;
      const ahead = daysAhead > 0 ? Math.min(FORECAST_AHEAD_DAYS, Math.ceil(daysAhead) + 1) : 1;
      url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,weather_code&past_days=${past}&forecast_days=${ahead}&timeformat=unixtime`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const times: number[] = data?.hourly?.time ?? [];
    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const codes: number[] = data?.hourly?.weather_code ?? [];
    if (times.length === 0 || temps.length === 0) return null;

    const idx = pickHourIndex(times, arrivalMs);
    const tempC = temps[idx];
    const code = codes[idx] ?? 0;
    if (tempC == null) return null;

    const { label, emoji } = describe(code);
    return { tempC: Math.round(tempC), code, label, emoji, isForecast: !isPast };
  } catch {
    return null;
  }
}
