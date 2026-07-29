"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { StatsBar } from "@/components/StatsBar";
import { SyncButton } from "@/components/SyncButton";
import { FlightCard } from "@/components/FlightCard";
import { AddFlightForm } from "@/components/AddFlightForm";
import type { FlightRecord } from "@/types/flight";
import type { FlightStats } from "@/lib/stats";

type Tab = "upcoming" | "past";

export default function DashboardPage() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [stats, setStats] = useState<FlightStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load flights");
      setFlights(data.flights);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this flight?")) return;
    const previous = flights;
    setFlights((f) => f.filter((flight) => flight.id !== id));
    const res = await fetch(`/api/flights/${id}`, { method: "DELETE" });
    if (!res.ok) {
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
    <main className="min-h-screen bg-paper">
      <Nav />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              + Add flight
            </button>
            <SyncButton onSynced={load} />
          </div>
        </div>

        {stats && <div className="mb-6"><StatsBar stats={stats} /></div>}

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            onClick={() => setTab("upcoming")}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              tab === "upcoming" ? "bg-white shadow-sm text-ink" : "text-slate-500"
            }`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setTab("past")}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              tab === "past" ? "bg-white shadow-sm text-ink" : "text-slate-500"
            }`}
          >
            Past ({past.length})
          </button>
        </div>

        {loading && <div className="py-12 text-center text-sm text-slate-400">Loading flights…</div>}
        {error && <div className="py-4 text-center text-sm text-red-600">{error}</div>}

        {!loading && !error && visible.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            No {tab} flights yet. Try "Sync now" or add one manually.
          </div>
        )}

        <div className="space-y-3">
          {visible.map((flight) => (
            <FlightCard key={flight.id} flight={flight} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {showAddForm && <AddFlightForm onAdded={load} onClose={() => setShowAddForm(false)} />}
    </main>
  );
}
