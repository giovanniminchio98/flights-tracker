import { google } from "googleapis";
import type { RawCalendarEvent } from "@/types/flight";

const WINDOW_YEARS_PAST = 2;
const WINDOW_YEARS_FUTURE = 1;

function syncWindow(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const min = new Date(now);
  min.setFullYear(min.getFullYear() - WINDOW_YEARS_PAST);
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + WINDOW_YEARS_FUTURE);
  return { timeMin: min.toISOString(), timeMax: max.toISOString() };
}

/** Fetches candidate events from all of the user's Google calendars across
 * the -2y/+1y sync window, using the given OAuth access token. */
export async function fetchGoogleCalendarEvents(accessToken: string): Promise<RawCalendarEvent[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const { timeMin, timeMax } = syncWindow();

  const calendarList = await calendar.calendarList.list();
  const calendarIds = (calendarList.data.items ?? [])
    .map((c) => c.id)
    .filter((id): id is string => Boolean(id));

  const events: RawCalendarEvent[] = [];

  for (const calendarId of calendarIds) {
    let pageToken: string | undefined;
    do {
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        maxResults: 2500,
        pageToken,
      });

      for (const event of res.data.items ?? []) {
        if (!event.id || !event.start || !event.end) continue;
        const start = event.start.dateTime ?? event.start.date;
        const end = event.end.dateTime ?? event.end.date;
        if (!start || !end) continue;

        events.push({
          source: "google",
          eventId: `${calendarId}:${event.id}`,
          summary: event.summary ?? "",
          description: event.description ?? "",
          location: event.location ?? "",
          start,
          end,
          googleEventType: event.eventType ?? undefined,
          iCalUID: event.iCalUID ?? undefined,
          sourceUrl: event.source?.url ?? undefined,
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return events;
}
