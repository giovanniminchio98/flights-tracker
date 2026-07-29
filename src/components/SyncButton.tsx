import { useState } from "react";
import { runGoogleSync } from "@/lib/sync";

export function SyncButton({ accessToken, onSynced }: { accessToken: string; onSynced: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const summary = await runGoogleSync(accessToken);
      setMessage(
        `${summary.newFlights} new, ${summary.updatedFlights} updated, ${summary.duplicatesSkipped} duplicates skipped ` +
          `(${summary.googleEventsScanned} Google events scanned)`
      );
      onSynced();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Sync Google now"}
      </button>
      {message && <div className={`text-xs ${isError ? "text-red-600" : "text-slate-500"}`}>{message}</div>}
    </div>
  );
}
