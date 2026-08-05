import type { FlightRecord } from "@/types";
import type { Tombstone } from "./localFlightStore";

/** Union two sets of flights that may have diverged on different devices.
 *
 * Records are keyed by the deterministic dedupe id (flight number + departure
 * date), so the same real-world flight logged on two devices collapses into
 * one row rather than duplicating. When both sides hold the same id, the one
 * touched most recently wins — `lastSyncedAt` is the edit clock.
 *
 * Tombstones are applied last: an id deleted after the surviving record was
 * last edited stays deleted, which is what stops a stale device from
 * resurrecting a flight the user removed elsewhere. */
export function mergeFlightSets(
  a: FlightRecord[],
  b: FlightRecord[],
  tombstones: Tombstone[]
): FlightRecord[] {
  const byId = new Map<string, FlightRecord>();

  for (const record of [...a, ...b]) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      continue;
    }
    byId.set(record.id, newer(existing, record));
  }

  const deletedAt = new Map<string, number>();
  for (const t of tombstones) {
    const ts = Date.parse(t.at);
    if (Number.isNaN(ts)) continue;
    deletedAt.set(t.id, Math.max(deletedAt.get(t.id) ?? 0, ts));
  }

  const out: FlightRecord[] = [];
  for (const record of byId.values()) {
    const killedAt = deletedAt.get(record.id);
    if (killedAt != null && killedAt >= editedAt(record)) continue;
    out.push(record);
  }

  return out.sort((x, y) => x.departureTime.localeCompare(y.departureTime));
}

function editedAt(r: FlightRecord): number {
  const t = Date.parse(r.lastSyncedAt);
  return Number.isNaN(t) ? 0 : t;
}

/** Later edit wins; ties keep the richer record so a merge never loses a
 * field that only one side had filled in. */
function newer(x: FlightRecord, y: FlightRecord): FlightRecord {
  const ex = editedAt(x);
  const ey = editedAt(y);
  if (ex !== ey) return ex > ey ? x : y;
  return filled(x) >= filled(y) ? x : y;
}

function filled(r: FlightRecord): number {
  return [r.airline, r.confirmationCode, r.departureAirport, r.arrivalAirport, r.arrivalTime].filter(
    Boolean
  ).length;
}

/** Drops tombstones that no longer protect anything, so the list can't grow
 * without bound. A tombstone is only useful while some device might still be
 * holding a copy of that flight — a generous retention window covers that. */
const TOMBSTONE_RETENTION_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export function pruneTombstones(tombstones: Tombstone[], now = Date.now()): Tombstone[] {
  const seen = new Map<string, string>();
  for (const t of tombstones) {
    const prev = seen.get(t.id);
    if (!prev || t.at > prev) seen.set(t.id, t.at);
  }
  return Array.from(seen.entries())
    .map(([id, at]) => ({ id, at }))
    .filter((t) => {
      const ts = Date.parse(t.at);
      return Number.isNaN(ts) ? false : now - ts < TOMBSTONE_RETENTION_MS;
    });
}
