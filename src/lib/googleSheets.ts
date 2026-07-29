import type { FlightRecord } from "@/types";
import { getStoredSpreadsheetId, setStoredSpreadsheetId } from "./localConfig";

const SPREADSHEET_TITLE = "Flight Tracker";
const SHEET_TITLE = "Flights";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export const HEADERS: (keyof FlightRecord)[] = [
  "id",
  "flightNumber",
  "airline",
  "confirmationCode",
  "departureAirport",
  "arrivalAirport",
  "departureTime",
  "arrivalTime",
  "linkedEventIds",
  "sources",
  "lastSyncedAt",
];

async function sheetsFetch(url: string, accessToken: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function toRow(record: FlightRecord): string[] {
  return HEADERS.map((key) => record[key] ?? "");
}

function fromRow(row: unknown[]): FlightRecord {
  const get = (i: number) => (row[i] != null ? String(row[i]) : "");
  return {
    id: get(0),
    flightNumber: get(1),
    airline: get(2),
    confirmationCode: get(3),
    departureAirport: get(4),
    arrivalAirport: get(5),
    departureTime: get(6),
    arrivalTime: get(7),
    linkedEventIds: get(8),
    sources: get(9),
    lastSyncedAt: get(10),
  };
}

const lastColumnLetter = String.fromCharCode(64 + HEADERS.length); // "K"

/** Returns the spreadsheet ID to use, creating the "Flight Tracker" sheet
 * (with a header row) on first run if none is saved in this browser yet. */
export async function ensureSpreadsheet(
  accessToken: string
): Promise<{ spreadsheetId: string; createdNew: boolean }> {
  const existing = getStoredSpreadsheetId();
  if (existing) {
    return { spreadsheetId: existing, createdNew: false };
  }

  const created = await sheetsFetch(SHEETS_API, accessToken, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: SHEET_TITLE } }],
    }),
  });

  const spreadsheetId = created.spreadsheetId as string | undefined;
  if (!spreadsheetId) throw new Error("Failed to create spreadsheet: no ID returned");

  await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_TITLE}!A1:${lastColumnLetter}1?valueInputOption=RAW`,
    accessToken,
    { method: "PUT", body: JSON.stringify({ values: [HEADERS] }) }
  );

  setStoredSpreadsheetId(spreadsheetId);
  return { spreadsheetId, createdNew: true };
}

async function getFlightsTabId(accessToken: string, spreadsheetId: string): Promise<number> {
  const meta = await sheetsFetch(`${SHEETS_API}/${spreadsheetId}`, accessToken);
  const sheet = (meta.sheets ?? []).find((s: any) => s.properties?.title === SHEET_TITLE);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Sheet tab "${SHEET_TITLE}" not found`);
  return sheetId;
}

export interface SheetRow {
  rowNumber: number; // 1-based, matches actual sheet row (header is row 1)
  record: FlightRecord;
}

export async function readFlightRows(accessToken: string, spreadsheetId: string): Promise<SheetRow[]> {
  const res = await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_TITLE}!A2:${lastColumnLetter}`,
    accessToken
  );

  const rows: unknown[][] = res.values ?? [];
  return rows
    .map((row, i) => ({ rowNumber: i + 2, record: fromRow(row) }))
    .filter((r) => r.record.id);
}

export async function appendFlightRows(
  accessToken: string,
  spreadsheetId: string,
  records: FlightRecord[]
): Promise<void> {
  if (records.length === 0) return;
  await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_TITLE}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    { method: "POST", body: JSON.stringify({ values: records.map(toRow) }) }
  );
}

export async function updateFlightRow(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number,
  record: FlightRecord
): Promise<void> {
  await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_TITLE}!A${rowNumber}:${lastColumnLetter}${rowNumber}?valueInputOption=RAW`,
    accessToken,
    { method: "PUT", body: JSON.stringify({ values: [toRow(record)] }) }
  );
}

export async function deleteFlightRow(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number
): Promise<void> {
  const sheetId = await getFlightsTabId(accessToken, spreadsheetId);
  await sheetsFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    }),
  });
}
