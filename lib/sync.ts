import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import { fetchICloudCalendarEvents, getICloudCredentialsFromEnv } from "@/lib/icloudCalendar";
import { parseFlightCandidate } from "@/lib/flightParser";
import { ensureSpreadsheet, readFlightRows, appendFlightRows, updateFlightRow } from "@/lib/googleSheets";
import { mergeCandidates } from "@/lib/dedupe";
import type { FlightCandidate, SyncSummary } from "@/types/flight";

/** Runs the full sync: Google Calendar + iCloud CalDAV -> flight heuristics
 * -> cross-source dedupe -> Google Sheet. Shared by the "Sync now" button
 * (app/api/sync) and the unattended app/api/cron/sync endpoint. */
export async function runSync(accessToken: string): Promise<SyncSummary> {
  const errors: string[] = [];

  const [googleEvents, icloudEvents] = await Promise.all([
    fetchGoogleCalendarEvents(accessToken).catch((err) => {
      errors.push(`Google Calendar: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }),
    (async () => {
      const creds = getICloudCredentialsFromEnv();
      if (!creds) return [];
      return fetchICloudCalendarEvents(creds).catch((err) => {
        errors.push(`iCloud CalDAV: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      });
    })(),
  ]);

  const candidates: FlightCandidate[] = [];
  for (const event of [...googleEvents, ...icloudEvents]) {
    const candidate = parseFlightCandidate(event);
    if (candidate) candidates.push(candidate);
  }

  const { spreadsheetId } = await ensureSpreadsheet(accessToken);
  const existingRows = await readFlightRows(accessToken, spreadsheetId);
  const plan = mergeCandidates(candidates, existingRows);

  await appendFlightRows(accessToken, spreadsheetId, plan.toAppend);
  for (const { rowNumber, record } of plan.toUpdate) {
    await updateFlightRow(accessToken, spreadsheetId, rowNumber, record);
  }

  return {
    ...plan.summary,
    googleEventsScanned: googleEvents.length,
    icloudEventsScanned: icloudEvents.length,
    errors,
  };
}
