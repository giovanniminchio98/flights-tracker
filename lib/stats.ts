import type { FlightRecord } from "@/types/flight";
import { distanceMiles } from "./airports";

export interface AirportTally {
  code: string;
  count: number;
}

export interface FlightStats {
  totalSegments: number;
  flightsThisYear: number;
  milesThisYear: number;
  milesAllTime: number;
  mostVisitedAirports: AirportTally[];
}

export function computeStats(flights: FlightRecord[]): FlightStats {
  const currentYear = new Date().getFullYear();
  const airportCounts = new Map<string, number>();
  let flightsThisYear = 0;
  let milesThisYear = 0;
  let milesAllTime = 0;

  for (const flight of flights) {
    const year = flight.departureTime ? new Date(flight.departureTime).getFullYear() : null;
    const isThisYear = year === currentYear;
    if (isThisYear) flightsThisYear++;

    for (const code of [flight.departureAirport, flight.arrivalAirport]) {
      if (!code) continue;
      airportCounts.set(code, (airportCounts.get(code) ?? 0) + 1);
    }

    const miles = distanceMiles(flight.departureAirport, flight.arrivalAirport);
    if (miles != null) {
      milesAllTime += miles;
      if (isThisYear) milesThisYear += miles;
    }
  }

  const mostVisitedAirports = Array.from(airportCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalSegments: flights.length,
    flightsThisYear,
    milesThisYear,
    milesAllTime,
    mostVisitedAirports,
  };
}
