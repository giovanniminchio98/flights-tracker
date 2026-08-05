/** Combines a calendar date (from a plain YYYY-MM-DD, e.g. an <input
 * type="date">) with the local time-of-day taken from a reference ISO
 * timestamp. Used to reuse a flight's usual departure/arrival clock time
 * when logging it again on a new date, without the user re-entering times. */
export function combineDateWithTimeOfDay(dateStr: string, referenceIso: string): Date {
  const reference = new Date(referenceIso);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, reference.getHours(), reference.getMinutes(), 0, 0);
}

/** Given a new departure date plus the historical departure/arrival pair
 * it's based on, computes the new departure and arrival timestamps,
 * preserving the original flight duration (so overnight flights still
 * land the next day). */
export function projectFlightTimes(
  newDateStr: string,
  historicalDepartureIso: string,
  historicalArrivalIso: string
): { departureTime: string; arrivalTime: string } {
  const newDeparture = combineDateWithTimeOfDay(newDateStr, historicalDepartureIso);
  const durationMs = new Date(historicalArrivalIso).getTime() - new Date(historicalDepartureIso).getTime();
  const newArrival = new Date(newDeparture.getTime() + durationMs);
  return { departureTime: newDeparture.toISOString(), arrivalTime: newArrival.toISOString() };
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours.toLocaleString()}h ${minutes}m`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "11:50 AM" — time of day. Pass an IANA `timeZone` (e.g. the destination
 * airport's) to render the local clock time *there* rather than in the
 * viewer's own timezone; omit it for viewer-local time. */
export function formatTimeShort(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone });
}

/** Short timezone label for a moment, e.g. "GMT+2" / "PDT". Empty if the
 * zone is unknown. Used to make airport-local times unambiguous. */
export function tzAbbrev(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** The viewer's own IANA timezone (their "star place"), e.g. "Europe/Rome". */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** "Fri, 31 Jul" — weekday + day + month, no time. Optionally in a given
 * timezone so the calendar date matches the airport-local one. */
export function formatDateShort(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone });
}

/** True when arrival falls on a later calendar day than departure (shows +1).
 * When timezones are supplied the comparison is done in each airport's local
 * date, so an overnight flight is flagged by where you land, not by UTC. */
export function isNextDay(
  departureIso: string,
  arrivalIso: string,
  departureTimeZone?: string,
  arrivalTimeZone?: string
): boolean {
  const a = new Date(departureIso);
  const b = new Date(arrivalIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  // en-CA gives a sortable YYYY-MM-DD, so a plain string compare works.
  const dayA = a.toLocaleDateString("en-CA", { timeZone: departureTimeZone });
  const dayB = b.toLocaleDateString("en-CA", { timeZone: arrivalTimeZone });
  return dayB > dayA;
}

/** Formats an ISO timestamp for a <input type="datetime-local"> value. */
export function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}`;
}
