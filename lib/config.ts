import fs from "fs";
import path from "path";

interface AppConfig {
  sheetId?: string;
  googleRefreshToken?: string;
}

const CONFIG_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(CONFIG_DIR, "app-config.json");

/** Best-effort local JSON config store, used to persist values (the
 * auto-created Sheet ID, a Google refresh token for unattended cron sync)
 * that would otherwise have nowhere to live since this app intentionally
 * has no database. Writable on a normal server or local dev; on read-only
 * serverless filesystems (e.g. Vercel) writes silently no-op and callers
 * should fall back to env vars instead. */
function readConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

function writeConfig(patch: Partial<AppConfig>): boolean {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const current = readConfig();
    const next = { ...current, ...patch };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function getSheetId(): string | null {
  return process.env.GOOGLE_SHEET_ID || readConfig().sheetId || null;
}

/** Persists a newly created spreadsheet's ID. Returns whether it was
 * durably saved to disk (false means: only usable for this process
 * lifetime, the caller should tell the user to set GOOGLE_SHEET_ID). */
export function persistSheetId(sheetId: string): boolean {
  return writeConfig({ sheetId });
}

export function getStoredGoogleRefreshToken(): string | null {
  return process.env.GOOGLE_REFRESH_TOKEN || readConfig().googleRefreshToken || null;
}

export function persistGoogleRefreshToken(token: string): boolean {
  return writeConfig({ googleRefreshToken: token });
}
