import { useCallback, useEffect, useState } from "react";
import { WorldMap } from "./WorldMap";
import { FlightsTab } from "./FlightsTab";
import { PassportTab } from "./PassportTab";
import { AddFlightForm } from "./AddFlightForm";
import { ApiKeySettings } from "./ApiKeySettings";
import { GlobeView } from "./GlobeView";
import {
  getFlights,
  deleteFlight,
  loadSampleFlights,
  clearSampleFlights,
  hasSampleFlights,
} from "@/lib/localFlightStore";
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
  const [showGlobe, setShowGlobe] = useState(false);

  const load = useCallback(() => {
    setFlights(getFlights());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDelete(id: string) {
    if (!confirm("Delete this flight?")) return;
    deleteFlight(id);
    if (highlightedId === id) setHighlightedId(null);
    load();
  }

  function handleLoadSamples() {
    loadSampleFlights();
    load();
  }

  function handleClearSamples() {
    clearSampleFlights();
    setShowAccountMenu(false);
    load();
  }

  const samplesPresent = hasSampleFlights();

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
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-2.5 text-ink">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-accent-soft">✈</span>
          <span>Skylog</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleUnits}
            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:bg-white/10"
            title="Toggle distance units"
          >
            {units === "km" ? "km" : "mi"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-ink hover:bg-white/20"
              title="Account"
            >
              👤
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-line bg-surface p-2 text-sm text-slate-200 shadow-lg">
                <div className="px-2 py-1.5 text-xs text-muted">Not signed in</div>
                <div className="px-2 py-1.5 text-xs text-muted">
                  iCloud &amp; Google sign-in are coming soon. For now, flights are stored in this browser.
                </div>
                <button
                  onClick={() => {
                    setShowApiSettings(true);
                    setShowAccountMenu(false);
                  }}
                  className="mt-1 w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                >
                  Flight lookup API…
                </button>
                {samplesPresent ? (
                  <button
                    onClick={handleClearSamples}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-red-400 hover:bg-white/5"
                  >
                    Clear sample flights
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLoadSamples();
                      setShowAccountMenu(false);
                    }}
                    className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                  >
                    Load sample flights
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pinned map — always visible on every tab */}
      <div className="relative z-10 shrink-0 border-b border-line">
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
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-accent/90 px-3 py-1 text-xs text-white">
            <span>{mapFilter.label}</span>
            <button onClick={() => setMapFilter(null)} className="text-slate-300 hover:text-white">
              ✕
            </button>
          </div>
        )}
        <button
          onClick={() => setShowGlobe(true)}
          className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface/90 px-3 py-1 text-xs text-ink shadow-sm hover:bg-surface"
          title="Open the interactive globe"
        >
          🌍 Globe
        </button>
      </div>

      {/* Tab bar */}
      <nav className="z-10 flex shrink-0 border-b border-line bg-surface">
        {(["flights", "passport"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition ${
              tab === t ? "border-b-2 border-ink text-ink" : "text-muted hover:text-slate-300"
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
              onLoadSamples={handleLoadSamples}
            />
          ) : (
            <PassportTab flights={flights} activeFilterLabel={mapFilter?.label ?? null} onSelectFilter={setMapFilter} />
          )}
        </div>
      </main>

      {/* Floating add button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg hover:bg-accent-soft"
        title="Add flight"
      >
        +
      </button>

      {showAddForm && <AddFlightForm onAdded={load} onClose={() => setShowAddForm(false)} />}
      {showApiSettings && <ApiKeySettings onClose={() => setShowApiSettings(false)} />}
      {showGlobe && <GlobeView flights={flights} onClose={() => setShowGlobe(false)} />}
    </div>
  );
}
