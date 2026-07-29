import type { FlightRecord } from "@/types";
import { distanceMiles, isKnownAirport, AIRPORTS, getContinent } from "./airports";

const EARTH_CIRCUMFERENCE_MILES = 24901;

export interface AirportTally {
  code: string;
  count: number;
}

export interface RouteRecord {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  miles: number;
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

export interface YearTally {
  year: number;
  count: number;
}

export interface FlightStats {
  totalSegments: number;
  upcomingCount: number;
  pastCount: number;
  flightsThisYear: number;
  milesThisYear: number;
  milesAllTime: number;
  mostVisitedAirports: AirportTally[];

  totalFlightMinutes: number;
  avgFlightMinutes: number;
  airportsVisited: number;
  countriesVisited: number;
  continentsVisited: number;
  airlinesFlown: number;

  longestFlight: RouteRecord | null;
  shortestFlight: RouteRecord | null;
  mostFrequentRoute: RouteTally | null;
  mostFlownAirline: AirlineTally | null;
  lapsAroundEarth: number;

  flightsByYear: YearTally[];
  busiestYear: YearTally | null;
}

function routeKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

export function computeStats(flights: FlightRecord[]): FlightStats {
  const now = Date.now();
  const currentYear = new Date().getFullYear();

  const airportCounts = new Map<string, number>();
  const countries = new Set<string>();
  const continents = new Set<string>();
  const airlines = new Map<string, number>();
  const routeCounts = new Map<string, RouteTally>();
  const yearCounts = new Map<number, number>();

  let flightsThisYear = 0;
  let milesThisYear = 0;
  let milesAllTime = 0;
  let upcomingCount = 0;
  let pastCount = 0;
  let totalFlightMinutes = 0;
  let durationsCounted = 0;

  let longestFlight: RouteRecord | null = null;
  let shortestFlight: RouteRecord | null = null;

  for (const flight of flights) {
    const departureMs = new Date(flight.departureTime).getTime();
    const year = flight.departureTime ? new Date(flight.departureTime).getFullYear() : null;
    const isThisYear = year === currentYear;
    if (isThisYear) flightsThisYear++;
    if (!Number.isNaN(departureMs)) {
      if (departureMs >= now) upcomingCount++;
      else pastCount++;
    }
    if (year != null && !Number.isNaN(year)) {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    }

    const durationMinutes = (new Date(flight.arrivalTime).getTime() - departureMs) / 60000;
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
      totalFlightMinutes += durationMinutes;
      durationsCounted++;
    }

    if (flight.airline) {
      airlines.set(flight.airline, (airlines.get(flight.airline) ?? 0) + 1);
    }

    for (const code of [flight.departureAirport, flight.arrivalAirport]) {
      if (!code) continue;
      airportCounts.set(code, (airportCounts.get(code) ?? 0) + 1);
      if (isKnownAirport(code)) {
        const info = AIRPORTS[code.toUpperCase()];
        countries.add(info.country);
        const continent = getContinent(info.country);
        if (continent) continents.add(continent);
      }
    }

    const miles = distanceMiles(flight.departureAirport, flight.arrivalAirport);
    if (miles != null) {
      milesAllTime += miles;
      if (isThisYear) milesThisYear += miles;

      const record: RouteRecord = {
        flightNumber: flight.flightNumber,
        departureAirport: flight.departureAirport.toUpperCase(),
        arrivalAirport: flight.arrivalAirport.toUpperCase(),
        miles,
      };
      if (!longestFlight || miles > longestFlight.miles) longestFlight = record;
      if (!shortestFlight || miles < shortestFlight.miles) shortestFlight = record;
    }

    if (flight.departureAirport && flight.arrivalAirport) {
      const key = routeKey(flight.departureAirport.toUpperCase(), flight.arrivalAirport.toUpperCase());
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
    .slice(0, 5);

  const mostFrequentRoute =
    Array.from(routeCounts.values()).sort((a, b) => b.count - a.count)[0] ?? null;

  const mostFlownAirlineEntry = Array.from(airlines.entries()).sort((a, b) => b[1] - a[1])[0];
  const mostFlownAirline = mostFlownAirlineEntry
    ? { airline: mostFlownAirlineEntry[0], count: mostFlownAirlineEntry[1] }
    : null;

  const flightsByYear = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
  const busiestYear = [...flightsByYear].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    totalSegments: flights.length,
    upcomingCount,
    pastCount,
    flightsThisYear,
    milesThisYear,
    milesAllTime,
    mostVisitedAirports,

    totalFlightMinutes: Math.round(totalFlightMinutes),
    avgFlightMinutes: durationsCounted > 0 ? Math.round(totalFlightMinutes / durationsCounted) : 0,
    airportsVisited: airportCounts.size,
    countriesVisited: countries.size,
    continentsVisited: continents.size,
    airlinesFlown: airlines.size,

    longestFlight,
    shortestFlight,
    mostFrequentRoute,
    mostFlownAirline,
    lapsAroundEarth: Math.round((milesAllTime / EARTH_CIRCUMFERENCE_MILES) * 100) / 100,

    flightsByYear,
    busiestYear,
  };
}
