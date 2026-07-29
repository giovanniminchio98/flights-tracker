import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureSpreadsheet, readFlightRows, appendFlightRows, updateFlightRow } from "@/lib/googleSheets";
import { computeFlightId } from "@/lib/dedupe";
import { computeStats } from "@/lib/stats";
import { lookupAirline } from "@/lib/airlines";
import type { FlightRecord } from "@/types/flight";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { spreadsheetId } = await ensureSpreadsheet(session.accessToken);
  const rows = await readFlightRows(session.accessToken, spreadsheetId);
  const flights = rows.map((r) => r.record);

  return NextResponse.json({ flights, stats: computeStats(flights) });
}

interface ManualFlightInput {
  flightNumber: string;
  airline?: string;
  confirmationCode?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<ManualFlightInput>;
  const { flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime } = body;

  if (!flightNumber || !departureAirport || !arrivalAirport || !departureTime || !arrivalTime) {
    return NextResponse.json(
      { error: "flightNumber, departureAirport, arrivalAirport, departureTime and arrivalTime are required" },
      { status: 400 }
    );
  }

  const normalizedFlightNumber = flightNumber.toUpperCase().replace(/\s+/g, "");
  const airlineCode = normalizedFlightNumber.match(/^[A-Z0-9]{2}/)?.[0] ?? "";
  const id = computeFlightId(normalizedFlightNumber, departureTime);
  const now = new Date().toISOString();

  const { spreadsheetId } = await ensureSpreadsheet(session.accessToken);
  const rows = await readFlightRows(session.accessToken, spreadsheetId);
  const existing = rows.find((r) => r.record.id === id);

  if (existing) {
    const r = existing.record;
    const merged: FlightRecord = {
      ...r,
      airline: r.airline || body.airline || lookupAirline(airlineCode),
      confirmationCode: r.confirmationCode || body.confirmationCode || "",
      departureAirport: r.departureAirport || departureAirport.toUpperCase(),
      arrivalAirport: r.arrivalAirport || arrivalAirport.toUpperCase(),
      arrivalTime: r.arrivalTime || arrivalTime,
      sources: Array.from(new Set([...r.sources.split(",").filter(Boolean), "manual"])).join(","),
      lastSyncedAt: now,
    };
    await updateFlightRow(session.accessToken, spreadsheetId, existing.rowNumber, merged);
    return NextResponse.json({ flight: merged, created: false });
  }

  const record: FlightRecord = {
    id,
    flightNumber: normalizedFlightNumber,
    airline: body.airline || lookupAirline(airlineCode),
    confirmationCode: body.confirmationCode ?? "",
    departureAirport: departureAirport.toUpperCase(),
    arrivalAirport: arrivalAirport.toUpperCase(),
    departureTime,
    arrivalTime,
    linkedEventIds: "",
    sources: "manual",
    lastSyncedAt: now,
  };
  await appendFlightRows(session.accessToken, spreadsheetId, [record]);
  return NextResponse.json({ flight: record, created: true }, { status: 201 });
}
