import type { RawCalendarEvent } from "@/types";

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

async function googleFetch(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

interface GoogleCalendarListEntry {
  id: string;
}

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  eventType?: string;
  iCalUID?: string;
  source?: { url?: string };
}

/** Fetches candidate events from all of the user's Google calendars across
 * the -2y/+1y sync window, calling the Calendar API directly from the
 * browser with the given OAuth access token (CORS-enabled for Bearer-token
 * requests, so no server proxy is needed). */
export async function fetchGoogleCalendarEvents(accessToken: string): Promise<RawCalendarEvent[]> {
  const { timeMin, timeMax } = syncWindow();

  const calendarList = await googleFetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    accessToken
  );
  const calendarIds: string[] = (calendarList.items ?? [])
    .map((c: GoogleCalendarListEntry) => c.id)
    .filter(Boolean);

  const events: RawCalendarEvent[] = [];

  for (const calendarId of calendarIds) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        maxResults: "2500",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        accessToken
      );

      for (const event of (res.items ?? []) as GoogleEvent[]) {
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
          googleEventType: event.eventType,
          iCalUID: event.iCalUID,
          sourceUrl: event.source?.url,
        });
      }

      pageToken = res.nextPageToken;
    } while (pageToken);
  }

  return events;
}
