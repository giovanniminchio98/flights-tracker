import type { FlightRecord } from "@/types";
import { FlightDetail } from "./FlightDetail";
import { getAirport } from "@/lib/airports";
import { formatDateShort, formatTimeShort, isNextDay } from "@/lib/dateUtils";
import { getCountdown, formatRelative } from "@/lib/countdown";
import { useNow } from "@/lib/useNow";

function toneClass(kind: string): string {
  if (kind === "soon" || kind === "inflight") return "text-emerald-400";
  return "text-ink";
}

/** Prominent upcoming/active row: big live countdown on the left (Flighty
 * style), slim body, tap to expand the full detail. */
function UpcomingRow({
  flight,
  now,
  expanded,
  onSelect,
  onDelete,
}: {
  flight: FlightRecord;
  now: number;
  expanded: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const depAir = getAirport(flight.departureAirport);
  const arrAir = getAirport(flight.arrivalAirport);
  const depCity = depAir?.city ?? flight.departureAirport;
  const arrCity = arrAir?.city ?? flight.arrivalAirport;
  const cd = getCountdown(flight.departureTime, flight.arrivalTime, now);

  return (
    <div className={`rounded-xl border bg-surface transition ${expanded ? "border-emerald-500/50" : "border-line"}`}>
      <button onClick={onSelect} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="w-14 shrink-0 text-center">
          <div className={`text-3xl font-bold leading-none ${toneClass(cd.kind)}`}>{cd.big}</div>
          <div className="mt-1 text-[10px] tracking-widest text-muted">{cd.unit}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-muted">
              {flight.airline || "Flight"} · {flight.flightNumber}
            </span>
            <span className="shrink-0 text-xs text-muted">{formatDateShort(flight.departureTime)}</span>
          </div>
          <div className="mt-0.5 truncate text-base font-semibold text-ink">
            {depCity} <span className="text-muted">→</span> {arrCity}
          </div>
          <div className="mt-1 flex gap-4 text-xs text-muted">
            <span>↗ {flight.departureAirport} {formatTimeShort(flight.departureTime, depAir?.tz)}</span>
            <span>
              ↘ {flight.arrivalAirport} {formatTimeShort(flight.arrivalTime, arrAir?.tz)}
              {isNextDay(flight.departureTime, flight.arrivalTime, depAir?.tz, arrAir?.tz) && (
                <sup className="ml-0.5">+1</sup>
              )}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <FlightDetail flight={flight} />
          <button onClick={onDelete} className="mt-3 text-xs text-muted hover:text-red-400">
            Delete flight
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact, de-emphasized past row — one line, muted, still tappable to
 * expand. Past flights matter less than upcoming ones. */
function PastRow({
  flight,
  now,
  expanded,
  onSelect,
  onDelete,
}: {
  flight: FlightRecord;
  now: number;
  expanded: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const ago = formatRelative(flight.departureTime, now);

  return (
    <div className={`rounded-lg border transition ${expanded ? "border-line bg-surface" : "border-transparent"}`}>
      <button
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${expanded ? "" : "opacity-70 hover:opacity-100"}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-16 shrink-0 font-mono text-[11px] text-muted">{formatDateShort(flight.departureTime)}</span>
          <span className="shrink-0 text-sm font-medium text-ink">
            {flight.departureAirport} <span className="text-muted">→</span> {flight.arrivalAirport}
          </span>
          <span className="truncate text-xs text-muted">
            {flight.airline || "Flight"} · {flight.flightNumber}
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-muted">{ago.str} ago</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <FlightDetail flight={flight} />
          <button onClick={onDelete} className="mt-3 text-xs text-muted hover:text-red-400">
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
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function FlightsTab({
  flights,
  highlightedId,
  onSelect,
  onDelete,
  onAdd,
  onLoadSamples,
}: {
  flights: FlightRecord[];
  highlightedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onLoadSamples: () => void;
}) {
  const now = useNow();

  // Upcoming/active = not yet landed (includes in-flight); past = already landed.
  const upcoming = [...flights]
    .filter((f) => new Date(f.arrivalTime).getTime() >= now)
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
  const past = [...flights]
    .filter((f) => new Date(f.arrivalTime).getTime() < now)
    .sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime())
    .slice(0, 30);

  if (flights.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-3xl">🛫</div>
        <div className="mt-3 text-sm text-muted">No flights yet.</div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            onClick={onAdd}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
          >
            Add your first flight
          </button>
          <button onClick={onLoadSamples} className="text-xs text-muted underline hover:text-ink">
            or load 2 sample flights to explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 ? (
        <Section title={`Upcoming (${upcoming.length})`}>
          {upcoming.map((f) => (
            <UpcomingRow
              key={f.id}
              flight={f}
              now={now}
              expanded={highlightedId === f.id}
              onSelect={() => onSelect(f.id)}
              onDelete={() => onDelete(f.id)}
            />
          ))}
        </Section>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 text-center text-sm text-muted">
          No upcoming flights — add one with the + button.
        </div>
      )}

      {past.length > 0 && (
        <Section title="Past flights">
          {past.map((f) => (
            <PastRow
              key={f.id}
              flight={f}
              now={now}
              expanded={highlightedId === f.id}
              onSelect={() => onSelect(f.id)}
              onDelete={() => onDelete(f.id)}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
