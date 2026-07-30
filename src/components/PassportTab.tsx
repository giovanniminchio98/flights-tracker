import type { FlightStats, LabeledCount } from "@/lib/stats";
import type { MapFilter } from "./AppShell";
import type { FlightRecord } from "@/types";
import { useUnits } from "@/lib/UnitsContext";
import { formatDistanceValue, unitLabel, countryFlag } from "@/lib/units";
import { formatDuration } from "@/lib/dateUtils";
import { getAirport } from "@/lib/airports";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{children}</div>;
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
      className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
        active ? "border-ink ring-1 ring-ink" : "border-slate-200"
      } ${onClick ? "hover:border-slate-400" : "cursor-default"}`}
    >
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
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
            <span className={`w-10 shrink-0 text-left font-mono ${activeLabel === d.label ? "text-ink" : "text-slate-500"}`}>
              {d.label}
            </span>
            <div className="h-3.5 flex-1 rounded-full bg-slate-100">
              <div
                className="h-3.5 rounded-full"
                style={{
                  width: `${d.count === 0 ? 0 : Math.max(6, (d.count / max) * 100)}%`,
                  backgroundColor: activeLabel === d.label ? "#eb6834" : "#2a78d6",
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

function yearFilter(year: string): MapFilter {
  return {
    label: `Flights in ${year}`,
    predicate: (f: FlightRecord) => String(new Date(f.departureTime).getFullYear()) === year,
  };
}

export function PassportTab({
  stats,
  activeFilterLabel,
  onSelectFilter,
}: {
  stats: FlightStats;
  activeFilterLabel: string | null;
  onSelectFilter: (f: MapFilter | null) => void;
}) {
  const { units } = useUnits();
  const u = unitLabel(units);

  if (stats.totalFlights === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">Add flights to build your passport.</div>;
  }

  function toggle(filter: MapFilter) {
    onSelectFilter(activeFilterLabel === filter.label ? null : filter);
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total flights" value={stats.totalFlights} />
          <Stat label="This year" value={stats.flightsThisYear} />
          <Stat label="Upcoming" value={stats.upcomingCount} />
          <Stat label="Unique routes" value={stats.uniqueRoutes} />
        </div>
      </div>

      <div>
        <SectionLabel>Distance &amp; time</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`Distance this year (${u})`} value={formatDistanceValue(stats.kmThisYear, units)} />
          <Stat label={`Distance all-time (${u})`} value={formatDistanceValue(stats.kmAllTime, units)} />
          <Stat label="Time in the air" value={formatDuration(stats.totalFlightMinutes)} />
          <Stat label="Avg flight" value={stats.avgFlightMinutes ? formatDuration(stats.avgFlightMinutes) : "—"} />
        </div>
      </div>

      <div>
        <SectionLabel>Impact</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Times around Earth" value={stats.lapsAroundEarth} sub="🌍" />
          <Stat label="Of the way to the Moon" value={`${stats.percentToMoon}%`} sub="🌙" />
          <Stat label="Est. CO₂" value={`${stats.co2Kg.toLocaleString()} kg`} sub="economy est." />
          <Stat label="Longest single flight" value={stats.longestDurationMinutes ? formatDuration(stats.longestDurationMinutes) : "—"} />
        </div>
      </div>

      <div>
        <SectionLabel>Reach</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Countries" value={stats.countriesVisited} />
          <Stat label="Continents" value={stats.continentsVisited} />
          <Stat label="Airports" value={stats.airportsVisited} />
          <Stat label="Airlines" value={stats.airlinesFlown} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Domestic" value={stats.domesticFlights} />
          <Stat label="International" value={stats.internationalFlights} />
        </div>
      </div>

      <div>
        <SectionLabel>Records — tap to show on the map</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.longestFlight && (
            <ClickableRecord
              title="Longest flight"
              value={`${stats.longestFlight.departureAirport} → ${stats.longestFlight.arrivalAirport}`}
              sub={`${formatDistanceValue(stats.longestFlight.km, units)} ${u}`}
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
              active={false}
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
                  activeFilterLabel === `Flights via ${a.code}` ? "bg-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {a.code} <span className="opacity-60">×{a.count}</span>
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
                    ? "bg-ink text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {countryFlag(c.label)} {c.label} <span className="opacity-60">×{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.flightsByYear.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-slate-500">Flights by year — tap a bar to filter the map</div>
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-slate-500">Flights by month</div>
          <BarList data={stats.flightsByMonth} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-slate-500">Flights by day of week</div>
          <BarList data={stats.flightsByWeekday} />
        </div>
      </div>
    </div>
  );
}
