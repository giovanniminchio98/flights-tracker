import { useRef, useState } from "react";
import { parseIcsToEvents } from "@/lib/icsParser";
import { runIcsImport } from "@/lib/sync";

export function IcsImportPanel({ accessToken, onImported }: { accessToken: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processIcsText(text: string) {
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const events = parseIcsToEvents(text);
      const summary = await runIcsImport(accessToken, events);
      setMessage(
        `${summary.newFlights} new, ${summary.updatedFlights} updated, ${summary.duplicatesSkipped} duplicates skipped ` +
          `(${summary.icloudEventsScanned} calendar events scanned)`
      );
      onImported();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Import failed — is that a valid .ics file?");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await processIcsText(text);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-ink"
      >
        <span>Import iCloud calendar (.ics)</span>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Export your iCloud calendar as an .ics file (Calendar app → select calendar → File → Export, or
            share a calendar publicly on iCloud.com and download its feed), then upload or paste it below. See{" "}
            <span className="font-medium">Settings</span> for step-by-step instructions.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-white/20"
          />

          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Or paste .ics content instead</summary>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder="BEGIN:VCALENDAR..."
              className="mt-2 w-full rounded-lg border border-line p-2 font-mono text-xs"
            />
            <button
              onClick={() => processIcsText(pasted)}
              disabled={loading || !pasted.trim()}
              className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? "Importing…" : "Import pasted calendar"}
            </button>
          </details>

          {message && <div className={`text-xs ${isError ? "text-red-400" : "text-muted"}`}>{message}</div>}
        </div>
      )}
    </div>
  );
}
