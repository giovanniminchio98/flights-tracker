import { useCallback, useEffect, useState } from "react";
import { StatsBar } from "./StatsBar";
import { SyncButton } from "./SyncButton";
import { IcsImportPanel } from "./IcsImportPanel";
import { FlightCard } from "./FlightCard";
import { AddFlightForm } from "./AddFlightForm";
import { loadFlights, deleteFlight } from "@/lib/sync";
import type { FlightRecord } from "@/types";
import type { FlightStats } from "@/lib/stats";

type Tab = "upcoming" | "past";

export function Dashboard({ accessToken }: { accessToken: string }) {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadFlights(accessToken);
      setFlights(data.flights);
      setStats(data.stats);
      setSpreadsheetId(data.spreadsheetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flights");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!spreadsheetId) return;
    if (!confirm("Delete this flight?")) return;
    const previous = flights;
    setFlights((f) => f.filter((flight) => flight.id !== id));
    try {
      await deleteFlight(accessToken, spreadsheetId, id);
    } catch {
      setFlights(previous);
      alert("Failed to delete flight");
    }
  }

  const now = Date.now();
  const upcoming = flights
    .filter((f) => new Date(f.departureTime).getTime() >= now)
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
  const past = flights
    .filter((f) => new Date(f.departureTime).getTime() < now)
    .sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());

  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50"
          >
            + Add flight
          </button>
          <SyncButton accessToken={accessToken} onSynced={load} />
        </div>
      </div>

      {stats && (
        <div className="mb-4">
          <StatsBar stats={stats} />
        </div>
      )}

      <div className="mb-6">
        <IcsImportPanel accessToken={accessToken} onImported={load} />
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          onClick={() => setTab("upcoming")}
          className={`flex-1 rounded-md py-1.5 font-medium transition ${
            tab === "upcoming" ? "bg-white text-ink shadow-sm" : "text-slate-500"
          }`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab("past")}
          className={`flex-1 rounded-md py-1.5 font-medium transition ${
            tab === "past" ? "bg-white text-ink shadow-sm" : "text-slate-500"
          }`}
        >
          Past ({past.length})
        </button>
      </div>

      {loading && <div className="py-12 text-center text-sm text-slate-400">Loading flights…</div>}
      {error && <div className="py-4 text-center text-sm text-red-600">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          No {tab} flights yet. Try "Sync Google now", import an iCloud .ics file, or add one manually.
        </div>
      )}

      <div className="space-y-3">
        {visible.map((flight) => (
          <FlightCard key={flight.id} flight={flight} onDelete={handleDelete} />
        ))}
      </div>

      {showAddForm && (
        <AddFlightForm accessToken={accessToken} onAdded={load} onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
}
