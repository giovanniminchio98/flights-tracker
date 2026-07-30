import { useCallback, useEffect, useMemo, useState } from "react";
import { WorldMap } from "./WorldMap";
import { FlightsTab } from "./FlightsTab";
import { PassportTab } from "./PassportTab";
import { AddFlightForm } from "./AddFlightForm";
import { ApiKeySettings } from "./ApiKeySettings";
import { getFlights, deleteFlight } from "@/lib/localFlightStore";
import { computeStats } from "@/lib/stats";
import { useUnits } from "@/lib/UnitsContext";
import type { FlightRecord } from "@/types";

export type Tab = "flights" | "passport";

/** A named filter the Passport tab can push onto the shared map — e.g.
 * "flights touching HEL" or "the longest flight". Lives here so both the
 * pinned map and the tab content react to the same selection. */
export interface MapFilter {
  label: string;
  predicate: (f: FlightRecord) => boolean;
}

export function AppShell() {
  const { units, toggleUnits } = useUnits();
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [tab, setTab] = useState<Tab>("flights");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const load = useCallback(() => {
    setFlights(getFlights());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => computeStats(flights), [flights]);

  function handleDelete(id: string) {
    if (!confirm("Delete this flight?")) return;
    deleteFlight(id);
    if (highlightedId === id) setHighlightedId(null);
    load();
  }

  function switchTab(next: Tab) {
    setTab(next);
    setHighlightedId(null);
    if (next === "flights") setMapFilter(null);
  }

  // On the Flights tab the map shows every flight; on Passport it honors the
  // active stat filter (highlighted flight still overrides via the map).
  const routeFilter = tab === "passport" && mapFilter ? mapFilter.predicate : undefined;

  return (
    <div className="flex h-screen flex-col bg-paper">
      {/* Header */}
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span>✈️</span>
          <span className="hidden sm:inline">Flight Tracker</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleUnits}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            title="Toggle distance units"
          >
            {units === "km" ? "km" : "mi"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 hover:bg-slate-200"
              title="Account"
            >
              👤
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
                <div className="px-2 py-1.5 text-xs text-slate-400">Not signed in</div>
                <div className="px-2 py-1.5 text-xs text-slate-500">
                  iCloud &amp; Google sign-in are coming soon. For now, flights are stored in this browser.
                </div>
                <button
                  onClick={() => {
                    setShowApiSettings(true);
                    setShowAccountMenu(false);
                  }}
                  className="mt-1 w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  Flight lookup API…
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pinned map — always visible on every tab */}
      <div className="relative z-10 shrink-0 border-b border-slate-200">
        <WorldMap
          flights={flights}
          highlightedId={highlightedId}
          routeFilter={routeFilter}
          heightClass="h-48 sm:h-64"
          onSelectFlight={(id) => {
            setHighlightedId((cur) => (cur === id ? null : id));
            setTab("flights");
          }}
        />
        {tab === "passport" && mapFilter && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-ink/90 px-3 py-1 text-xs text-white">
            <span>{mapFilter.label}</span>
            <button onClick={() => setMapFilter(null)} className="text-slate-300 hover:text-white">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <nav className="z-10 flex shrink-0 border-b border-slate-200 bg-white">
        {(["flights", "passport"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition ${
              tab === t ? "border-b-2 border-ink text-ink" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "flights" ? "Flights" : "Passport"}
          </button>
        ))}
      </nav>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5">
          {tab === "flights" ? (
            <FlightsTab
              flights={flights}
              highlightedId={highlightedId}
              onSelect={(id) => setHighlightedId((cur) => (cur === id ? null : id))}
              onDelete={handleDelete}
              onAdd={() => setShowAddForm(true)}
            />
          ) : (
            <PassportTab stats={stats} activeFilterLabel={mapFilter?.label ?? null} onSelectFilter={setMapFilter} />
          )}
        </div>
      </main>

      {/* Floating add button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-2xl text-white shadow-lg hover:bg-slate-800"
        title="Add flight"
      >
        +
      </button>

      {showAddForm && <AddFlightForm onAdded={load} onClose={() => setShowAddForm(false)} />}
      {showApiSettings && <ApiKeySettings onClose={() => setShowApiSettings(false)} />}
    </div>
  );
}
