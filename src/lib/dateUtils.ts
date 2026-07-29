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
