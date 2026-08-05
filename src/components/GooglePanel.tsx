import { useEffect, useRef, useState } from "react";
import {
  getGoogleClientId,
  setGoogleClientId,
} from "@/lib/localConfig";
import {
  getValidAccessToken,
  getUserEmail,
  signInWithGoogle,
  signOutGoogle,
} from "@/lib/googleAuth";
import { startSync, stopSync, syncNow } from "@/lib/syncEngine";
import { importFromGoogleCalendar, importFromIcs, type ImportResult } from "@/lib/calendarImport";

/** Account + import panel. Everything Google-related lives behind a Client ID
 * the user supplies once; with none set the app never touches Google and the
 * rest of the UI is exactly the local-only experience. */
export function GooglePanel({ onClose, onFlightsChanged }: { onClose: () => void; onFlightsChanged: () => void }) {
  const [clientId, setClientIdState] = useState(getGoogleClientId() ?? "");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const signedIn = email != null;

  useEffect(() => {
    const token = getValidAccessToken();
    if (!token) return;
    void getUserEmail(token).then(setEmail);
  }, []);

  async function handleSignIn() {
    setError(null);
    const id = clientId.trim();
    if (!id) {
      setError("Paste your Google OAuth Client ID first.");
      return;
    }
    setGoogleClientId(id);
    setBusy("Opening Google…");
    try {
      const token = await signInWithGoogle(id);
      setEmail(await getUserEmail(token));
      setBusy("Syncing with Drive…");
      await startSync();
      onFlightsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  function handleSignOut() {
    signOutGoogle();
    stopSync();
    setEmail(null);
    setResult(null);
  }

  async function handleImportGoogle() {
    const token = getValidAccessToken();
    if (!token) {
      setError("Sign in again to read your calendar.");
      return;
    }
    setError(null);
    setBusy("Scanning your Google calendars…");
    try {
      const r = await importFromGoogleCalendar(token);
      setResult(r);
      onFlightsChanged();
      void syncNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleIcsFile(file: File) {
    setError(null);
    setBusy("Reading calendar file…");
    try {
      const r = importFromIcs(await file.text());
      setResult(r);
      onFlightsChanged();
      void syncNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that .ics file");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-ink">Google &amp; calendar sync</h2>
        <p className="mb-4 text-xs text-muted">
          Optional. Without this, Skylog keeps everything in this browser exactly as it does now.
        </p>

        {/* ---- Step 1: Client ID ---- */}
        {!signedIn && (
          <label className="block text-sm">
            <span className="text-ink">Google OAuth Client ID</span>
            <input
              value={clientId}
              onChange={(e) => setClientIdState(e.target.value)}
              placeholder="123-abc.apps.googleusercontent.com"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink"
            />
            <span className="mt-1 block text-[11px] text-muted">
              A Client ID is public by design — there's no secret to leak. Create one in Google Cloud
              Console → Credentials → OAuth client ID → Web application, and add this site to the
              authorised JavaScript origins.
            </span>
          </label>
        )}

        {/* ---- Step 2: account ---- */}
        <div className="mt-4 rounded-lg border border-line bg-white/5 p-3">
          {signedIn ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted">Signed in</div>
                <div className="truncate text-sm text-ink">{email}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-neon-red"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={busy != null}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-50"
            >
              Sign in with Google
            </button>
          )}
          <div className="mt-2 text-[11px] text-muted">
            Flights are stored in a private app folder in your Drive that only Skylog can see — this
            app is never granted access to the rest of your Drive.
          </div>
        </div>

        {/* ---- Step 3: import ---- */}
        <div className="mt-4">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">Find my flights</div>

          <button
            onClick={handleImportGoogle}
            disabled={!signedIn || busy != null}
            className="w-full rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-white/5 disabled:opacity-40"
          >
            Scan Google Calendar
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy != null}
            className="mt-2 w-full rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-white/5 disabled:opacity-40"
          >
            Import iPhone / iCloud calendar (.ics)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleIcsFile(f);
              e.target.value = "";
            }}
          />
          <div className="mt-1 text-[11px] text-muted">
            Apple has no browser-accessible calendar API, so iCloud works by file: on iPhone use
            Calendar → share/export, or on iCloud.com export the calendar, then pick the .ics here.
          </div>
        </div>

        {busy && <div className="mt-4 text-sm text-neon-yellow">{busy}</div>}
        {error && <div className="mt-4 text-sm text-neon-red">{error}</div>}

        {result && (
          <div className="mt-4 rounded-lg border border-line bg-white/5 p-3 text-xs">
            <div className="text-ink">
              Added <span className="font-semibold text-neon-green">{result.added.length}</span>, skipped{" "}
              <span className="font-semibold text-neon-yellow">{result.duplicates.length}</span> duplicate
              {result.duplicates.length === 1 ? "" : "s"}.
            </div>
            <div className="mt-1 text-muted">
              Scanned {result.eventsScanned} calendar entr{result.eventsScanned === 1 ? "y" : "ies"}
              {result.unparsed > 0 && ` · ${result.unparsed} looked like flights but couldn't be read`}.
            </div>
            {result.duplicates.length > 0 && (
              <ul className="mt-2 max-h-24 overflow-y-auto text-muted">
                {result.duplicates.map((d) => (
                  <li key={d}>· {d} — already logged</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-white/10">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
