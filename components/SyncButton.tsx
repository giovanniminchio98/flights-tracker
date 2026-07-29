"use client";

import { useState } from "react";
import type { SyncSummary } from "@/types/flight";

export function SyncButton({ onSynced }: { onSynced: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncSummary & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      setMessage(
        `${data.newFlights} new, ${data.updatedFlights} updated, ${data.duplicatesSkipped} duplicates skipped` +
          (data.errors.length ? ` (${data.errors.length} source error${data.errors.length > 1 ? "s" : ""})` : "")
      );
      setIsError(data.errors.length > 0);
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
        {loading ? "Syncing…" : "Sync now"}
      </button>
      {message && (
        <div className={`text-xs ${isError ? "text-red-600" : "text-slate-500"}`}>{message}</div>
      )}
    </div>
  );
}
