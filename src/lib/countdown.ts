/** Time-to-departure helpers for the Flighty-style countdown. The displayed
 * granularity tightens as the flight nears (days → hours → minutes), and
 * "close" (within 48h of departure) is what turns the countdown/times green
 * in the UI. */

const CLOSE_MS = 48 * 60 * 60 * 1000;

export type CountdownKind = "far" | "soon" | "inflight" | "past";

export interface Countdown {
  kind: CountdownKind;
  big: string; // large number/label, e.g. "11", "1", "IN"
  unit: string; // small label under it, e.g. "DAYS", "HOURS", "AIR"
}

export function getCountdown(departureIso: string, arrivalIso: string, now: number): Countdown {
  const dep = new Date(departureIso).getTime();
  const arr = new Date(arrivalIso).getTime();
  if (Number.isNaN(dep)) return { kind: "past", big: "", unit: "" };
  if (!Number.isNaN(arr) && now >= arr) return { kind: "past", big: "", unit: "" };
  if (now >= dep) return { kind: "inflight", big: "IN", unit: "AIR" };

  const ms = dep - now;
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const close = ms <= CLOSE_MS;

  let big: string;
  let unit: string;
  if (days >= 2) {
    big = String(days);
    unit = "DAYS";
  } else if (hours >= 24) {
    big = "1";
    unit = "DAY";
  } else if (hours >= 1) {
    big = String(hours);
    unit = hours === 1 ? "HOUR" : "HOURS";
  } else {
    big = String(Math.max(1, mins));
    unit = "MIN";
  }

  return { kind: close ? "soon" : "far", big, unit };
}

/** True when the flight departs within the "close" window (green treatment). */
export function isClose(departureIso: string, now: number): boolean {
  const dep = new Date(departureIso).getTime();
  if (Number.isNaN(dep)) return false;
  return dep - now <= CLOSE_MS && dep - now >= 0;
}

/** A precise relative string like "23h 46m", "3d 4h", "12m", plus whether the
 * target is already in the past (so callers can say "in …" vs "… ago"). */
export function formatRelative(targetIso: string, now: number): { str: string; past: boolean } {
  const t = new Date(targetIso).getTime();
  if (Number.isNaN(t)) return { str: "", past: false };
  let ms = t - now;
  const past = ms < 0;
  ms = Math.abs(ms);
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let str: string;
  if (days >= 1) str = `${days}d ${hours % 24}h`;
  else if (hours >= 1) str = `${hours}h ${mins % 60}m`;
  else str = `${Math.max(0, mins)}m`;
  return { str, past };
}
