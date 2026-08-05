import { useMemo, useState } from "react";
import { computeStats, type LabeledCount } from "@/lib/stats";
import type { MapFilter } from "./AppShell";
import type { FlightRecord } from "@/types";
import { useUnits } from "@/lib/UnitsContext";
import { formatDistanceValue, unitLabel, countryFlag } from "@/lib/units";
import { formatDuration } from "@/lib/dateUtils";
import { getAirport } from "@/lib/airports";
import { PAST_COLOR, UPCOMING_COLOR } from "@/lib/theme";

/** Neon accents for stat numbers. Used sparingly — one hue per theme of stat
 * so the grid reads as grouped rather than as a rainbow. */
export type Tone = "ink" | "green" | "violet" | "yellow" | "red" | "cyan";

const TONE_CLASS: Record<Tone, string> = {
  ink: "text-ink",
  green: "text-neon-green",
  violet: "text-neon-violet",
  yellow: "text-neon-yellow",
  red: "text-neon-red",
  cyan: "text-neon-cyan",
};

function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm">
      <div className={`text-2xl font-semibold ${TONE_CLASS[tone]}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{children}</div>;
}

function ClickableRecord({
  title,
  value,
  sub,
  active,
  onClick,
}: {
  title: string;
  value: string;
  sub?: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border bg-surface p-4 text-left shadow-sm transition ${
        active ? "border-ink ring-1 ring-ink" : "border-line"
      } ${onClick ? "hover:border-neon-violet" : "cursor-default"}`}
    >
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </button>
  );
}

function BarList({
  data,
  onBarClick,
  activeLabel,
}: {
  data: LabeledCount[];
  onBarClick?: (d: LabeledCount) => void;
  activeLabel?: string | null;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const clickable = Boolean(onBarClick) && d.count > 0;
        return (
          <button
            key={d.label}
            disabled={!clickable}
            onClick={() => clickable && onBarClick!(d)}
            className={`flex w-full items-center gap-2 text-xs ${clickable ? "hover:opacity-80" : "cursor-default"}`}
          >
            <span className={`w-10 shrink-0 text-left font-mono ${activeLabel === d.label ? "text-ink" : "text-muted"}`}>
              {d.label}
            </span>
            <div className="h-3.5 flex-1 rounded-full bg-white/10">
              <div
                className="h-3.5 rounded-full"
                style={{
                  width: `${d.count === 0 ? 0 : Math.max(6, (d.count / max) * 100)}%`,
                  backgroundColor: activeLabel === d.label ? UPCOMING_COLOR : PAST_COLOR,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-ink">{d.count}</span>
          </button>
        );
      })}
    </div>
  );
}

const EQUATOR_KM = 40075;
const MOON_KM = 384400;

/** A track with a plane travelling from a start emoji toward an end emoji,
 * used for the Earth→Moon / around-the-world journey visuals. */
function JourneyMeter({
  startEmoji,
  endEmoji,
  pct,
  title,
  detail,
}: {
  startEmoji: string;
  endEmoji: string;
  pct: number; // 0..100 position of the plane
  title: string;
  detail: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-muted">{Math.round(pct)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{startEmoji}</span>
        <div className="relative h-2 flex-1 rounded-full bg-white/10">
          <div className="absolute left-0 top-0 h-2 rounded-full bg-accent" style={{ width: `${clamped}%` }} />
          <div
            className="absolute -top-2 -translate-x-1/2 text-sm transition-all"
            style={{ left: `${clamped}%` }}
          >
            ✈
          </div>
        </div>
        <span className="text-lg">{endEmoji}</span>
      </div>
      <div className="mt-2 text-xs text-muted">{detail}</div>
    </div>
  );
}

function airportFilter(code: string): MapFilter {
  const up = code.toUpperCase();
  return {
    label: `Flights via ${up}`,
    predicate: (f: FlightRecord) => f.departureAirport.toUpperCase() === up || f.arrivalAirport.toUpperCase() === up,
  };
}

function countryFilter(country: string): MapFilter {
  return {
    label: `Flights in ${countryFlag(country)} ${country}`,
    predicate: (f: FlightRecord) =>
      getAirport(f.departureAirport)?.country === country || getAirport(f.arrivalAirport)?.country === country,
  };
}

function routeFilterFor(a: string, b: string): MapFilter {
  const pair = [a.toUpperCase(), b.toUpperCase()].sort().join("-");
  return {
    label: `${a} ↔ ${b}`,
    predicate: (f: FlightRecord) =>
      [f.departureAirport.toUpperCase(), f.arrivalAirport.toUpperCase()].sort().join("-") === pair,
  };
}

function airlineFilter(airline: string): MapFilter {
  return {
    label: `Flights on ${airline}`,
    predicate: (f: FlightRecord) => f.airline === airline,
  };
}

function yearFilter(year: string): MapFilter {
  return {
    label: `Flights in ${year}`,
    predicate: (f: FlightRecord) => String(new Date(f.departureTime).getFullYear()) === year,
  };
}

export function PassportTab({
  flights,
  activeFilterLabel,
  onSelectFilter,
}: {
  flights: FlightRecord[];
  activeFilterLabel: string | null;
  onSelectFilter: (f: MapFilter | null) => void;
}) {
  const { units } = useUnits();
  const u = unitLabel(units);

  // Year filter — recomputes every stat over just the chosen year's flights.
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          flights
            .map((f) => new Date(f.departureTime).getFullYear())
            .filter((y) => !Number.isNaN(y))
        )
      ).sort((a, b) => b - a),
    [flights]
  );
  const [year, setYear] = useState<number | "all">("all");
  const scoped = useMemo(
    () => (year === "all" ? flights : flights.filter((f) => new Date(f.departureTime).getFullYear() === year)),
    [flights, year]
  );
  const stats = useMemo(() => computeStats(scoped), [scoped]);

  if (flights.length === 0) {
    return <div className="py-16 text-center text-sm text-muted">Add flights to build your passport.</div>;
  }

  function toggle(filter: MapFilter) {
    onSelectFilter(activeFilterLabel === filter.label ? null : filter);
  }

  return (
    <div className="space-y-6">
      {years.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Year</span>
          <button
            onClick={() => setYear("all")}
            className={`rounded-full px-3 py-1 text-xs transition ${
              year === "all" ? "bg-accent text-white" : "bg-white/10 text-muted hover:bg-white/20"
            }`}
          >
            All
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                year === y ? "bg-accent text-white" : "bg-white/10 text-muted hover:bg-white/20"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat tone="violet" label="Total flights" value={stats.totalFlights} />
          {year === "all" ? (
            <Stat tone="violet" label="This year" value={stats.flightsThisYear} />
          ) : (
            <Stat tone="ink" label="Past" value={stats.pastCount} />
          )}
          <Stat tone="green" label="Upcoming" value={stats.upcomingCount} />
          <Stat tone="cyan" label="Unique routes" value={stats.uniqueRoutes} />
        </div>
      </div>

      <div>
        <SectionLabel>Distance &amp; time</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {year === "all" ? (
            <>
              <Stat tone="cyan" label={`Distance this year (${u})`} value={formatDistanceValue(stats.kmThisYear, units)} />
              <Stat tone="cyan" label={`Distance all-time (${u})`} value={formatDistanceValue(stats.kmAllTime, units)} />
            </>
          ) : (
            // Scoped to one year, "this year vs all-time" collapses to a single
            // figure — showing it twice would just repeat the same number.
            <Stat tone="cyan" label={`Distance in ${year} (${u})`} value={formatDistanceValue(stats.kmAllTime, units)} />
          )}
          <Stat tone="yellow" label="Time in the air" value={formatDuration(stats.totalFlightMinutes)} />
          <Stat tone="yellow" label="Avg flight" value={stats.avgFlightMinutes ? formatDuration(stats.avgFlightMinutes) : "—"} />
        </div>
      </div>

      <div>
        <SectionLabel>Your journey</SectionLabel>
        <div className="space-y-3">
          <JourneyMeter
            startEmoji="🌍"
            endEmoji="🌙"
            pct={stats.percentToMoon}
            title="Toward the Moon"
            detail={
              stats.percentToMoon >= 100
                ? `You've flown past the Moon — ${(stats.kmAllTime / MOON_KM).toFixed(1)}× the 384,400 km trip! 🚀`
                : `${formatDistanceValue(stats.kmAllTime, units)} ${u} flown — ${stats.percentToMoon}% of the 384,400 km to the Moon.`
            }
          />
          <JourneyMeter
            startEmoji="🛫"
            endEmoji="🌍"
            pct={(stats.lapsAroundEarth % 1) * 100}
            title="Around the world"
            detail={
              stats.lapsAroundEarth >= 1
                ? `${stats.lapsAroundEarth}× around the Earth (equator ≈ 40,075 km) — ${Math.round((stats.lapsAroundEarth % 1) * 100)}% into lap ${Math.floor(stats.lapsAroundEarth) + 1}.`
                : `${Math.round(stats.lapsAroundEarth * 100)}% of the way around the equator (${EQUATOR_KM.toLocaleString()} km).`
            }
          />
          {/* Laps and total distance are already shown by the meters above, so
           * this row only carries what they don't: the emissions figures. */}
          <div className="grid grid-cols-2 gap-3">
            <Stat tone="red" label="Est. CO₂" value={`${stats.co2Kg.toLocaleString()} kg`} sub="per traveller, economy est." />
            <Stat tone="green" label="Trees to offset" value={`${Math.max(0, Math.round(stats.co2Kg / 21)).toLocaleString()} 🌳`} sub="~1yr each" />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Reach</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat tone="green" label="Countries" value={stats.countriesVisited} />
          <Stat tone="cyan" label="Continents" value={stats.continentsVisited} />
          <Stat tone="violet" label="Airports" value={stats.airportsVisited} />
          <Stat tone="yellow" label="Airlines" value={stats.airlinesFlown} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat tone="cyan" label="Domestic" value={stats.domesticFlights} />
          <Stat tone="violet" label="International" value={stats.internationalFlights} />
        </div>
      </div>

      <div>
        <SectionLabel>Records — tap to show on the map</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.longestFlight && (
            <ClickableRecord
              title="Longest flight"
              value={`${stats.longestFlight.departureAirport} → ${stats.longestFlight.arrivalAirport}`}
              sub={`${formatDistanceValue(stats.longestFlight.km, units)} ${u}${
                stats.longestDurationMinutes ? ` · ${formatDuration(stats.longestDurationMinutes)}` : ""
              }`}
              active={activeFilterLabel === `${stats.longestFlight.departureAirport} ↔ ${stats.longestFlight.arrivalAirport}`}
              onClick={() => toggle(routeFilterFor(stats.longestFlight!.departureAirport, stats.longestFlight!.arrivalAirport))}
            />
          )}
          {stats.shortestFlight && (
            <ClickableRecord
              title="Shortest flight"
              value={`${stats.shortestFlight.departureAirport} → ${stats.shortestFlight.arrivalAirport}`}
              sub={`${formatDistanceValue(stats.shortestFlight.km, units)} ${u}`}
              active={activeFilterLabel === `${stats.shortestFlight.departureAirport} ↔ ${stats.shortestFlight.arrivalAirport}`}
              onClick={() => toggle(routeFilterFor(stats.shortestFlight!.departureAirport, stats.shortestFlight!.arrivalAirport))}
            />
          )}
          {stats.mostFrequentRoute && (
            <ClickableRecord
              title="Most frequent route"
              value={`${stats.mostFrequentRoute.departureAirport} ↔ ${stats.mostFrequentRoute.arrivalAirport}`}
              sub={`${stats.mostFrequentRoute.count}×`}
              active={activeFilterLabel === `${stats.mostFrequentRoute.departureAirport} ↔ ${stats.mostFrequentRoute.arrivalAirport}`}
              onClick={() =>
                toggle(routeFilterFor(stats.mostFrequentRoute!.departureAirport, stats.mostFrequentRoute!.arrivalAirport))
              }
            />
          )}
          {stats.mostVisitedAirport && (
            <ClickableRecord
              title="Most visited airport"
              value={stats.mostVisitedAirport.code}
              sub={`${stats.mostVisitedAirport.count} flights`}
              active={activeFilterLabel === `Flights via ${stats.mostVisitedAirport.code}`}
              onClick={() => toggle(airportFilter(stats.mostVisitedAirport!.code))}
            />
          )}
          {stats.mostFlownAirline && (
            <ClickableRecord
              title="Most flown airline"
              value={stats.mostFlownAirline.airline}
              sub={`${stats.mostFlownAirline.count} flights`}
              active={activeFilterLabel === `Flights on ${stats.mostFlownAirline.airline}`}
              onClick={() => toggle(airlineFilter(stats.mostFlownAirline!.airline))}
            />
          )}
        </div>
      </div>

      {stats.mostVisitedAirports.length > 0 && (
        <div>
          <SectionLabel>Top airports — tap to filter the map</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {stats.mostVisitedAirports.map((a) => (
              <button
                key={a.code}
                onClick={() => toggle(airportFilter(a.code))}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  activeFilterLabel === `Flights via ${a.code}` ? "bg-accent text-white" : "bg-white/10 text-ink hover:bg-white/20"
                }`}
              >
                {a.code} <span className="opacity-60">×{a.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.topAirlines.length > 0 && (
        <div>
          <SectionLabel>Top airlines — tap to filter the map</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {stats.topAirlines.map((a) => (
              <button
                key={a.airline}
                onClick={() => toggle(airlineFilter(a.airline))}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  activeFilterLabel === `Flights on ${a.airline}`
                    ? "bg-accent text-white"
                    : "bg-white/10 text-ink hover:bg-white/20"
                }`}
              >
                {a.airline} <span className="opacity-60">×{a.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.topCountries.length > 0 && (
        <div>
          <SectionLabel>Top countries — tap to filter the map</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {stats.topCountries.map((c) => (
              <button
                key={c.label}
                onClick={() => toggle(countryFilter(c.label))}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  activeFilterLabel === `Flights in ${countryFlag(c.label)} ${c.label}`
                    ? "bg-accent text-white"
                    : "bg-white/10 text-ink hover:bg-white/20"
                }`}
              >
                {countryFlag(c.label)} {c.label} <span className="opacity-60">×{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.flightsByYear.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-muted">Flights by year — tap a bar to filter the map</div>
          <BarList
            data={stats.flightsByYear}
            activeLabel={
              stats.flightsByYear.find((y) => activeFilterLabel === `Flights in ${y.label}`)?.label ?? null
            }
            onBarClick={(d) => toggle(yearFilter(d.label))}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-muted">Flights by month</div>
          <BarList data={stats.flightsByMonth} />
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-muted">Flights by day of week</div>
          <BarList data={stats.flightsByWeekday} />
        </div>
      </div>
    </div>
  );
}
