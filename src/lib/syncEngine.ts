import type { FlightRecord } from "@/types";
import {
  getFlights,
  getTombstones,
  replaceAllFlights,
  onFlightsChanged,
  type Tombstone,
} from "./localFlightStore";
import { mergeFlightSets, pruneTombstones } from "./mergeFlights";
import { DriveAuthError, loadFromDrive, saveToDrive } from "./driveStore";
import { getValidAccessToken } from "./googleAuth";

/** Local-first sync to Google Drive.
 *
 * localStorage stays the source of truth the UI reads, so every interaction
 * is instant and the app keeps working with no network and no Google account
 * at all. Drive is a replica that this engine pushes to when it can and pulls
 * from on sign-in. A failed push is never lost: the engine stays "error",
 * retries with backoff, and flushes the moment connectivity returns. */

export type SyncStatus =
  /** No Google Client ID configured, or not signed in — app runs local-only. */
  | "disabled"
  /** Everything local has reached Drive. */
  | "synced"
  /** A push or pull is in flight. */
  | "syncing"
  /** Offline, or the last attempt failed; changes are queued locally. */
  | "error";

export interface SyncState {
  status: SyncStatus;
  message: string;
  lastSyncedAt: string | null;
  pendingChanges: boolean;
}

let state: SyncState = {
  status: "disabled",
  message: "Local only",
  lastSyncedAt: null,
  pendingChanges: false,
};

const listeners = new Set<(s: SyncState) => void>();

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

// ---------------------------------------------------------------------------

let enabled = false;
let fileId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 2000;
let inFlight = false;
/** Set when a change lands while a push is running, so we push again after. */
let dirtyDuringPush = false;
let unsubscribeStore: (() => void) | null = null;

const PUSH_DEBOUNCE_MS = 1500;
const MAX_RETRY_MS = 60_000;

function token(): string | null {
  return getValidAccessToken();
}

/** Turns on syncing for a signed-in account: pull + merge, then push the
 * merged result so both sides agree before any further edits. */
export async function startSync(): Promise<void> {
  if (enabled) return;
  enabled = true;
  unsubscribeStore = onFlightsChanged(markDirty);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  await pullAndMerge();
}

export function stopSync(): void {
  enabled = false;
  fileId = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  clearTimers();
  setState({ status: "disabled", message: "Local only", pendingChanges: false });
}

function clearTimers(): void {
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = null;
  retryTimer = null;
}

function handleOnline(): void {
  // Connectivity is back — flush whatever is queued right away.
  retryDelayMs = 2000;
  if (state.pendingChanges) schedulePush(0);
}

function handleOffline(): void {
  setState({ status: "error", message: "Offline — changes saved on this device" });
}

/** Called on every local mutation. */
export function markDirty(): void {
  if (!enabled) return;
  setState({ pendingChanges: true });
  if (inFlight) {
    dirtyDuringPush = true;
    return;
  }
  schedulePush(PUSH_DEBOUNCE_MS);
}

function schedulePush(delay: number): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void push();
  }, delay);
}

/** Pulls the Drive copy, merges it with local, writes the union to both. */
export async function pullAndMerge(): Promise<void> {
  if (!enabled) return;
  const accessToken = token();
  if (!accessToken) {
    setState({ status: "error", message: "Sign in to sync" });
    return;
  }

  setState({ status: "syncing", message: "Syncing…" });
  try {
    const remote = await loadFromDrive(accessToken);
    const localFlights = getFlights();
    const localTombs = getTombstones();

    const tombstones = pruneTombstones([...(remote?.tombstones ?? []), ...localTombs]);
    const merged = mergeFlightSets(localFlights, remote?.flights ?? [], tombstones);

    fileId = remote?.fileId ?? null;
    replaceAllFlights(merged, tombstones);

    // Write the merged view back so the other devices converge too.
    await pushNow(accessToken, merged, tombstones);
  } catch (err) {
    reportFailure(err);
  }
}

async function push(): Promise<void> {
  if (!enabled || inFlight) return;
  const accessToken = token();
  if (!accessToken) {
    setState({ status: "error", message: "Sign in to sync" });
    return;
  }
  try {
    await pushNow(accessToken, getFlights(), pruneTombstones(getTombstones()));
  } catch (err) {
    reportFailure(err);
  }
}

async function pushNow(
  accessToken: string,
  flights: FlightRecord[],
  tombstones: Tombstone[]
): Promise<void> {
  inFlight = true;
  dirtyDuringPush = false;
  setState({ status: "syncing", message: "Syncing…" });
  try {
    fileId = await saveToDrive(
      accessToken,
      { flights, tombstones, updatedAt: new Date().toISOString() },
      fileId
    );
    retryDelayMs = 2000;
    const now = new Date().toISOString();
    inFlight = false;
    if (dirtyDuringPush) {
      // Something changed mid-push; fold it in rather than declaring success.
      setState({ lastSyncedAt: now });
      schedulePush(PUSH_DEBOUNCE_MS);
      return;
    }
    setState({
      status: "synced",
      message: "All changes saved to Drive",
      lastSyncedAt: now,
      pendingChanges: false,
    });
  } finally {
    inFlight = false;
  }
}

function reportFailure(err: unknown): void {
  const authProblem = err instanceof DriveAuthError;
  setState({
    status: "error",
    message: authProblem
      ? "Google sign-in expired — sign in again"
      : navigator.onLine
        ? "Couldn't reach Drive — will retry"
        : "Offline — changes saved on this device",
    pendingChanges: true,
  });
  // Auth failures won't fix themselves; everything else is worth retrying.
  if (authProblem) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    void push();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
}

/** Forces an immediate sync, e.g. from a "retry" affordance in the UI. */
export async function syncNow(): Promise<void> {
  if (!enabled) return;
  clearTimers();
  retryDelayMs = 2000;
  await pullAndMerge();
}
