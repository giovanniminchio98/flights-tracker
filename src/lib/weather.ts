import { getAirport } from "./airports";

/** Arrival-airport weather via Open-Meteo — free, no API key, CORS-enabled,
 * so it works from a static site with nothing for the user to configure.
 *
 * Forecasts only reach ~7 days ahead (the app's chosen window); for a past
 * flight we read the historical archive instead. Anything further out than
 * the window returns null and the UI simply omits the weather line. */

const FORECAST_WINDOW_DAYS = 7;

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

function pickHourIndex(times: string[], targetIso: string): number {
  const target = new Date(targetIso).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target);
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

  const now = Date.now();
  const daysAhead = (arrival.getTime() - now) / 86400000;
  const isPast = arrival.getTime() < now;

  // Too far in the future to have any signal.
  if (daysAhead > FORECAST_WINDOW_DAYS) return null;

  const { lat, lon } = airport;
  const dateStr = isoDate(arrival);

  try {
    let url: string;
    if (isPast) {
      // Historical archive (has a few days' lag but fine for past trips).
      url =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weather_code&timezone=auto`;
    } else {
      url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,weather_code&forecast_days=${FORECAST_WINDOW_DAYS + 1}&timezone=auto`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const times: string[] = data?.hourly?.time ?? [];
    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const codes: number[] = data?.hourly?.weather_code ?? [];
    if (times.length === 0 || temps.length === 0) return null;

    const idx = pickHourIndex(times, arrivalIso);
    const tempC = temps[idx];
    const code = codes[idx] ?? 0;
    if (tempC == null) return null;

    const { label, emoji } = describe(code);
    return { tempC: Math.round(tempC), code, label, emoji, isForecast: !isPast };
  } catch {
    return null;
  }
}
