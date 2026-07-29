import { DAVClient } from "tsdav";
import * as ical from "node-ical";
import type { RawCalendarEvent } from "@/types/flight";

const ICLOUD_SERVER_URL = "https://caldav.icloud.com";
const WINDOW_YEARS_PAST = 2;
const WINDOW_YEARS_FUTURE = 1;

export interface ICloudCredentials {
  appleId: string;
  appPassword: string;
}

export function getICloudCredentialsFromEnv(): ICloudCredentials | null {
  const appleId = process.env.ICLOUD_APPLE_ID;
  const appPassword = process.env.ICLOUD_APP_PASSWORD;
  if (!appleId || !appPassword) return null;
  return { appleId, appPassword };
}

function syncWindow(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - WINDOW_YEARS_PAST);
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + WINDOW_YEARS_FUTURE);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function buildClient(creds: ICloudCredentials): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: ICLOUD_SERVER_URL,
    credentials: {
      username: creds.appleId,
      password: creds.appPassword,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  return client;
}

/** Verifies the configured Apple ID + app-specific password can authenticate
 * and discover calendars, without pulling any events. Used by the settings
 * page "test connection" action. */
export async function testICloudConnection(
  creds: ICloudCredentials
): Promise<{ ok: true; calendarCount: number } | { ok: false; error: string }> {
  try {
    const client = await buildClient(creds);
    const calendars = await client.fetchCalendars();
    return { ok: true, calendarCount: calendars.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetches candidate events from all discoverable iCloud calendars across
 * the -2y/+1y sync window via CalDAV. */
export async function fetchICloudCalendarEvents(
  creds: ICloudCredentials
): Promise<RawCalendarEvent[]> {
  const client = await buildClient(creds);
  const calendars = await client.fetchCalendars();
  const { start, end } = syncWindow();

  const events: RawCalendarEvent[] = [];

  for (const calendar of calendars) {
    if (!calendar.url) continue;

    let objects;
    try {
      objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: { start, end },
      });
    } catch {
      // Some collections (e.g. subscribed read-only calendars) can reject
      // time-range queries; skip rather than fail the whole sync.
      continue;
    }

    for (const obj of objects) {
      if (!obj.data) continue;

      let parsed: ical.CalendarResponse;
      try {
        parsed = ical.parseICS(obj.data);
      } catch {
        continue;
      }

      for (const key of Object.keys(parsed)) {
        const component = parsed[key];
        if (!component || component.type !== "VEVENT") continue;
        const vevent = component as ical.VEvent;
        if (!vevent.start || !vevent.end) continue;

        events.push({
          source: "icloud",
          eventId: vevent.uid ?? obj.url ?? key,
          summary: vevent.summary ?? "",
          description: (vevent.description as string) ?? "",
          location: (vevent.location as string) ?? "",
          start: new Date(vevent.start).toISOString(),
          end: new Date(vevent.end).toISOString(),
        });
      }
    }
  }

  return events;
}
