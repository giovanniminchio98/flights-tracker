import { google, sheets_v4 } from "googleapis";
import type { FlightRecord } from "@/types/flight";
import { getSheetId, persistSheetId } from "./config";

const SPREADSHEET_TITLE = "Flight Tracker";
const SHEET_TITLE = "Flights";

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

function getSheetsClient(accessToken: string): sheets_v4.Sheets {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
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

/** Returns the spreadsheet ID to use, creating the "Flight Tracker" sheet
 * (with a header row) on first run if none is configured yet. `persisted`
 * indicates whether the ID was durably saved to disk (data/app-config.json)
 * — false means the caller should surface it so the user can copy it into
 * GOOGLE_SHEET_ID for serverless deploys where the filesystem isn't writable. */
export async function ensureSpreadsheet(
  accessToken: string
): Promise<{ spreadsheetId: string; persisted: boolean; createdNew: boolean }> {
  const existing = getSheetId();
  if (existing) {
    return { spreadsheetId: existing, persisted: true, createdNew: false };
  }

  const sheets = getSheetsClient(accessToken);
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: SHEET_TITLE } }],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Failed to create spreadsheet: no ID returned");

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TITLE}!A1:${String.fromCharCode(64 + HEADERS.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });

  const persisted = persistSheetId(spreadsheetId);
  return { spreadsheetId, persisted, createdNew: true };
}

async function getFlightsTabId(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_TITLE);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Sheet tab "${SHEET_TITLE}" not found`);
  return sheetId;
}

export interface SheetRow {
  rowNumber: number; // 1-based, matches actual sheet row (header is row 1)
  record: FlightRecord;
}

export async function readFlightRows(accessToken: string, spreadsheetId: string): Promise<SheetRow[]> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TITLE}!A2:${String.fromCharCode(64 + HEADERS.length)}`,
  });

  const rows = res.data.values ?? [];
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
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TITLE}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: records.map(toRow) },
  });
}

export async function updateFlightRow(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number,
  record: FlightRecord
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TITLE}!A${rowNumber}:${String.fromCharCode(64 + HEADERS.length)}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [toRow(record)] },
  });
}

export async function deleteFlightRow(
  accessToken: string,
  spreadsheetId: string,
  rowNumber: number
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const sheetId = await getFlightsTabId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
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
    },
  });
}
