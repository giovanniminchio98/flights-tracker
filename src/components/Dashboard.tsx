import { useCallback, useEffect, useState } from "react";
import { StatsBar } from "./StatsBar";
import { FlightCard } from "./FlightCard";
import { AddFlightForm } from "./AddFlightForm";
import { getFlights, deleteFlight } from "@/lib/localFlightStore";
import { computeStats } from "@/lib/stats";
import type { FlightRecord } from "@/types";
import type { FlightStats } from "@/lib/stats";

type Tab = "upcoming" | "past";

export function Dashboard() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(() => {
    const current = getFlights();
    setFlights(current);
    setStats(computeStats(current));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDelete(id: string) {
    if (!confirm("Delete this flight?")) return;
    deleteFlight(id);
    load();
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
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add flight
        </button>
      </div>

      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Standalone mode: flights are stored in this browser only. Google Calendar sync and iCloud import are
        coming back in a follow-up.
      </div>

      {stats && (
        <div className="mb-6">
          <StatsBar stats={stats} />
        </div>
      )}

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

      {visible.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          No {tab} flights yet. Add one manually to get started.
        </div>
      )}

      <div className="space-y-3">
        {visible.map((flight) => (
          <FlightCard key={flight.id} flight={flight} onDelete={handleDelete} />
        ))}
      </div>

      {showAddForm && <AddFlightForm onAdded={load} onClose={() => setShowAddForm(false)} />}
    </div>
  );
}
