import type { FlightRecord } from "@/types";
import { distanceKm, isKnownAirport, getAirport } from "./airports";

const EARTH_CIRCUMFERENCE_KM = 40075;
const MOON_DISTANCE_KM = 384400;

// Rough economy-class emission factor: ~0.09 kg CO2 per passenger-kilometre,
// a commonly cited average across short/long haul. This is an estimate for
// personal awareness, not a certified figure.
const CO2_KG_PER_KM = 0.09;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface AirportTally {
  code: string;
  count: number;
}

export interface RouteRecord {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  km: number;
}

export interface RouteTally {
  departureAirport: string;
  arrivalAirport: string;
  count: number;
}

export interface AirlineTally {
  airline: string;
  count: number;
}

export interface LabeledCount {
  label: string;
  count: number;
}

export interface FlightStats {
  totalFlights: number;
  upcomingCount: number;
  pastCount: number;
  flightsThisYear: number;

  // canonical kilometres — UI converts to the user's unit
  kmThisYear: number;
  kmAllTime: number;

  totalFlightMinutes: number;
  avgFlightMinutes: number;
  longestDurationMinutes: number;

  co2Kg: number;

  airportsVisited: number;
  countriesVisited: number;
  continentsVisited: number;
  airlinesFlown: number;
  uniqueRoutes: number;

  domesticFlights: number;
  internationalFlights: number;

  longestFlight: RouteRecord | null;
  shortestFlight: RouteRecord | null;
  mostFrequentRoute: RouteTally | null;
  mostFlownAirline: AirlineTally | null;
  /** Airlines by flight count, most-flown first (max 6). */
  topAirlines: AirlineTally[];
  mostVisitedAirport: AirportTally | null;

  lapsAroundEarth: number;
  percentToMoon: number;

  mostVisitedAirports: AirportTally[];
  topCountries: LabeledCount[];
  flightsByYear: LabeledCount[];
  flightsByMonth: LabeledCount[]; // 12 entries, Jan..Dec
  flightsByWeekday: LabeledCount[]; // 7 entries, Sun..Sat
  busiestYear: LabeledCount | null;
}

function routeKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

export function computeStats(flights: FlightRecord[]): FlightStats {
  const now = Date.now();
  const currentYear = new Date().getFullYear();

  const airportCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const continents = new Set<string>();
  const airlines = new Map<string, number>();
  const routeCounts = new Map<string, RouteTally>();
  const yearCounts = new Map<number, number>();
  const monthCounts = new Array(12).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  const uniqueRoutes = new Set<string>();

  let flightsThisYear = 0;
  let kmThisYear = 0;
  let kmAllTime = 0;
  let upcomingCount = 0;
  let pastCount = 0;
  let totalFlightMinutes = 0;
  let durationsCounted = 0;
  let longestDurationMinutes = 0;
  let domesticFlights = 0;
  let internationalFlights = 0;

  let longestFlight: RouteRecord | null = null;
  let shortestFlight: RouteRecord | null = null;

  for (const flight of flights) {
    const dep = new Date(flight.departureTime);
    const departureMs = dep.getTime();
    const validDate = !Number.isNaN(departureMs);
    const year = validDate ? dep.getFullYear() : null;
    const isThisYear = year === currentYear;
    if (isThisYear) flightsThisYear++;

    if (validDate) {
      if (departureMs >= now) upcomingCount++;
      else pastCount++;
      yearCounts.set(dep.getFullYear(), (yearCounts.get(dep.getFullYear()) ?? 0) + 1);
      monthCounts[dep.getMonth()]++;
      weekdayCounts[dep.getDay()]++;
    }

    const durationMinutes = (new Date(flight.arrivalTime).getTime() - departureMs) / 60000;
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
      totalFlightMinutes += durationMinutes;
      durationsCounted++;
      if (durationMinutes > longestDurationMinutes) longestDurationMinutes = durationMinutes;
    }

    if (flight.airline) {
      airlines.set(flight.airline, (airlines.get(flight.airline) ?? 0) + 1);
    }

    const depInfo = getAirport(flight.departureAirport);
    const arrInfo = getAirport(flight.arrivalAirport);
    for (const info of [depInfo, arrInfo]) {
      if (!info) continue;
      countryCounts.set(info.country, (countryCounts.get(info.country) ?? 0) + 1);
      if (info.continent) continents.add(info.continent);
    }
    if (depInfo && arrInfo) {
      if (depInfo.country && depInfo.country === arrInfo.country) domesticFlights++;
      else internationalFlights++;
    }

    for (const code of [flight.departureAirport, flight.arrivalAirport]) {
      if (!code) continue;
      const key = code.toUpperCase();
      airportCounts.set(key, (airportCounts.get(key) ?? 0) + 1);
    }

    const km = distanceKm(flight.departureAirport, flight.arrivalAirport);
    if (km != null) {
      kmAllTime += km;
      if (isThisYear) kmThisYear += km;

      const record: RouteRecord = {
        flightNumber: flight.flightNumber,
        departureAirport: flight.departureAirport.toUpperCase(),
        arrivalAirport: flight.arrivalAirport.toUpperCase(),
        km,
      };
      if (!longestFlight || km > longestFlight.km) longestFlight = record;
      if (!shortestFlight || km < shortestFlight.km) shortestFlight = record;
    }

    if (flight.departureAirport && flight.arrivalAirport) {
      const key = routeKey(flight.departureAirport.toUpperCase(), flight.arrivalAirport.toUpperCase());
      uniqueRoutes.add(key);
      const existing = routeCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        routeCounts.set(key, {
          departureAirport: flight.departureAirport.toUpperCase(),
          arrivalAirport: flight.arrivalAirport.toUpperCase(),
          count: 1,
        });
      }
    }
  }

  const mostVisitedAirports = Array.from(airportCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const topCountries = Array.from(countryCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const mostFrequentRoute = Array.from(routeCounts.values()).sort((a, b) => b.count - a.count)[0] ?? null;

  const topAirlines = Array.from(airlines.entries())
    .map(([airline, count]) => ({ airline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const mostFlownAirline = topAirlines[0] ?? null;

  const flightsByYear = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ label: String(year), count }))
    .sort((a, b) => Number(a.label) - Number(b.label));
  const busiestYear = [...flightsByYear].sort((a, b) => b.count - a.count)[0] ?? null;

  const flightsByMonth = MONTHS.map((label, i) => ({ label, count: monthCounts[i] }));
  const flightsByWeekday = WEEKDAYS.map((label, i) => ({ label, count: weekdayCounts[i] }));

  return {
    totalFlights: flights.length,
    upcomingCount,
    pastCount,
    flightsThisYear,

    kmThisYear,
    kmAllTime,

    totalFlightMinutes: Math.round(totalFlightMinutes),
    avgFlightMinutes: durationsCounted > 0 ? Math.round(totalFlightMinutes / durationsCounted) : 0,
    longestDurationMinutes: Math.round(longestDurationMinutes),

    co2Kg: Math.round(kmAllTime * CO2_KG_PER_KM),

    airportsVisited: airportCounts.size,
    countriesVisited: countryCounts.size,
    continentsVisited: continents.size,
    airlinesFlown: airlines.size,
    uniqueRoutes: uniqueRoutes.size,

    domesticFlights,
    internationalFlights,

    longestFlight,
    shortestFlight,
    mostFrequentRoute,
    mostFlownAirline,
    topAirlines,
    mostVisitedAirport: mostVisitedAirports[0] ?? null,

    lapsAroundEarth: Math.round((kmAllTime / EARTH_CIRCUMFERENCE_KM) * 100) / 100,
    percentToMoon: Math.round((kmAllTime / MOON_DISTANCE_KM) * 1000) / 10,

    mostVisitedAirports,
    topCountries,
    flightsByYear,
    flightsByMonth,
    flightsByWeekday,
    busiestYear,
  };
}

/** Country-code → display name for the stats UI (covers the codes present in
 * the bundled airport data's most-common countries; falls back to the code). */
export { isKnownAirport };
