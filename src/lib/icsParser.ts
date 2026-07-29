import ICAL from "ical.js";
import type { RawCalendarEvent } from "@/types";

/** Parses an .ics file's text (exported from Apple Calendar / iCloud —
 * see Settings for how to get one) into the same RawCalendarEvent shape
 * used for Google Calendar events, entirely in the browser. This replaces
 * live iCloud CalDAV sync, which isn't reachable from a static site (no
 * server to hold the app-specific password or proxy around CORS). */
export function parseIcsToEvents(icsText: string): RawCalendarEvent[] {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  const events: RawCalendarEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    if (!event.startDate || !event.endDate) continue;

    events.push({
      source: "icloud",
      eventId: event.uid || `${event.summary}-${event.startDate.toString()}`,
      summary: event.summary ?? "",
      description: event.description ?? "",
      location: event.location ?? "",
      start: event.startDate.toJSDate().toISOString(),
      end: event.endDate.toJSDate().toISOString(),
    });
  }

  return events;
}
