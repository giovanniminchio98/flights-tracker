import type { FlightRecord } from "@/types";
import { FlightDetail } from "./FlightDetail";
import { getAirport } from "@/lib/airports";
import { formatDateTime } from "@/lib/dateUtils";

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  google: { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-200" },
  icloud: { label: "iCloud", className: "bg-slate-100 text-slate-600 border-slate-300" },
  manual: { label: "Manual", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

function FlightRow({
  flight,
  expanded,
  onSelect,
  onDelete,
}: {
  flight: FlightRecord;
  expanded: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const depCity = getAirport(flight.departureAirport)?.city;
  const arrCity = getAirport(flight.arrivalAirport)?.city;
  const sources = flight.sources.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition ${expanded ? "border-ink" : "border-slate-200"}`}>
      <button onClick={onSelect} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{flight.airline || "Flight"}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">{flight.flightNumber}</span>
          </div>
          <div className="mt-1 text-lg font-medium text-ink">
            {flight.departureAirport}
            <span className="mx-2 text-slate-400">→</span>
            {flight.arrivalAirport}
          </div>
          {(depCity || arrCity) && (
            <div className="truncate text-xs text-slate-400">
              {depCity ?? flight.departureAirport} → {arrCity ?? flight.arrivalAirport}
            </div>
          )}
          <div className="mt-1 text-sm text-slate-500">{formatDateTime(flight.departureTime)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {sources.map((s) => {
            const b = SOURCE_BADGES[s] ?? { label: s, className: "bg-slate-100 text-slate-600 border-slate-300" };
            return (
              <span key={s} className={`rounded-full border px-2 py-0.5 text-xs ${b.className}`}>
                {b.label}
              </span>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <FlightDetail flight={flight} />
          <button onClick={onDelete} className="mt-3 text-xs text-slate-400 hover:text-red-600">
            Delete flight
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function FlightsTab({
  flights,
  highlightedId,
  onSelect,
  onDelete,
  onAdd,
}: {
  flights: FlightRecord[];
  highlightedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + 86400000;

  const sorted = [...flights].sort(
    (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
  );

  const today = sorted.filter((f) => {
    const t = new Date(f.departureTime).getTime();
    return t >= startOfToday.getTime() && t < endOfToday;
  });
  const upcoming = sorted.filter((f) => new Date(f.departureTime).getTime() >= endOfToday);
  const past = sorted
    .filter((f) => new Date(f.departureTime).getTime() < startOfToday.getTime())
    .reverse()
    .slice(0, 20);

  if (flights.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-3xl">🛫</div>
        <div className="mt-3 text-sm text-slate-500">No flights yet.</div>
        <button
          onClick={onAdd}
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add your first flight
        </button>
      </div>
    );
  }

  const renderRow = (f: FlightRecord) => (
    <FlightRow
      key={f.id}
      flight={f}
      expanded={highlightedId === f.id}
      onSelect={() => onSelect(f.id)}
      onDelete={() => onDelete(f.id)}
    />
  );

  return (
    <div className="space-y-6">
      {today.length > 0 && <Section title="Today">{today.map(renderRow)}</Section>}
      {upcoming.length > 0 && <Section title={`Upcoming (${upcoming.length})`}>{upcoming.map(renderRow)}</Section>}
      {past.length > 0 && <Section title="Recent flights">{past.map(renderRow)}</Section>}
      {today.length === 0 && upcoming.length === 0 && (
        <div className="pt-2 text-center text-xs text-slate-400">No upcoming flights — add one with the + button.</div>
      )}
    </div>
  );
}
