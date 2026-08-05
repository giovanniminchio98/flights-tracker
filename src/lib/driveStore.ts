import type { FlightRecord } from "@/types";
import type { Tombstone } from "./localFlightStore";

/** Flight storage in Google Drive's `appDataFolder` — a hidden per-app folder
 * that doesn't appear in the user's Drive UI and can't be read by other apps.
 * It needs only the `drive.appdata` scope (not full Drive access), so signing
 * in never grants this app sight of the user's own documents.
 *
 * The whole flight list is one small JSON document. At personal-log scale
 * (hundreds of rows, a few tens of KB) a read-modify-write of the entire file
 * is far simpler and less error-prone than per-record syncing, and it makes
 * the merge on the client trivially auditable. */

const FILE_NAME = "skylog-flights.json";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export interface DriveSnapshot {
  flights: FlightRecord[];
  tombstones: Tombstone[];
  /** ISO timestamp written by whichever device saved last. */
  updatedAt: string;
}

export interface DriveState extends DriveSnapshot {
  fileId: string;
}

/** Raised when the access token is missing/expired so callers can prompt a
 * re-auth instead of treating it as a transient network failure. */
export class DriveAuthError extends Error {}

async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new DriveAuthError(`Google rejected the request (${res.status}) — sign in again.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

async function findFileId(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: "files(id)",
    pageSize: "1",
  });
  const res = await driveFetch(`${FILES_URL}?${params}`, token);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

function emptySnapshot(): DriveSnapshot {
  return { flights: [], tombstones: [], updatedAt: new Date(0).toISOString() };
}

/** Reads the snapshot, or null when this account has never saved one. */
export async function loadFromDrive(token: string): Promise<DriveState | null> {
  const fileId = await findFileId(token);
  if (!fileId) return null;

  const res = await driveFetch(`${FILES_URL}/${fileId}?alt=media`, token);
  const raw = (await res.json()) as Partial<DriveSnapshot>;
  return {
    fileId,
    flights: Array.isArray(raw.flights) ? raw.flights : [],
    tombstones: Array.isArray(raw.tombstones) ? raw.tombstones : [],
    updatedAt: raw.updatedAt ?? emptySnapshot().updatedAt,
  };
}

/** Writes the snapshot, creating the file on first use. Returns the file id
 * so the caller can keep using the cheaper update path afterwards. */
export async function saveToDrive(
  token: string,
  snapshot: DriveSnapshot,
  knownFileId?: string | null
): Promise<string> {
  const body = JSON.stringify(snapshot);
  const fileId = knownFileId ?? (await findFileId(token));

  if (fileId) {
    await driveFetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return fileId;
  }

  // First save: multipart create so metadata and content go in one request.
  const boundary = `skylog${Math.random().toString(36).slice(2)}`;
  const metadata = { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, token, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  const created = (await res.json()) as { id: string };
  return created.id;
}
