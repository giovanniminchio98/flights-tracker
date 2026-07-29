import type { FlightStats } from "@/lib/stats";
import { formatDuration } from "@/lib/dateUtils";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{children}</div>;
}

function RecordCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function StatsBar({ stats }: { stats: FlightStats }) {
  const records: { title: string; value: string; sub?: string }[] = [];

  if (stats.longestFlight) {
    records.push({
      title: "Longest flight",
      value: `${stats.longestFlight.departureAirport} → ${stats.longestFlight.arrivalAirport}`,
      sub: `${stats.longestFlight.miles.toLocaleString()} mi · ${stats.longestFlight.flightNumber}`,
    });
  }
  if (stats.shortestFlight && stats.shortestFlight !== stats.longestFlight) {
    records.push({
      title: "Shortest flight",
      value: `${stats.shortestFlight.departureAirport} → ${stats.shortestFlight.arrivalAirport}`,
      sub: `${stats.shortestFlight.miles.toLocaleString()} mi · ${stats.shortestFlight.flightNumber}`,
    });
  }
  if (stats.mostFrequentRoute) {
    records.push({
      title: "Most frequent route",
      value: `${stats.mostFrequentRoute.departureAirport} ↔ ${stats.mostFrequentRoute.arrivalAirport}`,
      sub: `${stats.mostFrequentRoute.count} flight${stats.mostFrequentRoute.count === 1 ? "" : "s"}`,
    });
  }
  if (stats.mostFlownAirline) {
    records.push({
      title: "Most flown airline",
      value: stats.mostFlownAirline.airline,
      sub: `${stats.mostFlownAirline.count} flight${stats.mostFlownAirline.count === 1 ? "" : "s"}`,
    });
  }

  const maxYearCount = Math.max(1, ...stats.flightsByYear.map((y) => y.count));

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total flights" value={stats.totalSegments} />
          <Stat label="Flights this year" value={stats.flightsThisYear} />
          <Stat label="Upcoming" value={stats.upcomingCount} />
          <Stat label="Past" value={stats.pastCount} />
        </div>
      </div>

      <div>
        <SectionLabel>Distance &amp; time</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Miles this year" value={stats.milesThisYear.toLocaleString()} />
          <Stat label="Miles all-time" value={stats.milesAllTime.toLocaleString()} />
          <Stat label="Time in the air" value={formatDuration(stats.totalFlightMinutes)} />
          <Stat label="Avg flight length" value={stats.avgFlightMinutes ? formatDuration(stats.avgFlightMinutes) : "—"} />
        </div>
      </div>

      <div>
        <SectionLabel>Reach</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Countries visited" value={stats.countriesVisited} />
          <Stat label="Continents visited" value={stats.continentsVisited} />
          <Stat label="Airports visited" value={stats.airportsVisited} />
          <Stat label="Airlines flown" value={stats.airlinesFlown} />
        </div>
      </div>

      {stats.lapsAroundEarth > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          You've flown enough to circle the Earth <span className="font-semibold text-ink">{stats.lapsAroundEarth}</span>{" "}
          time{stats.lapsAroundEarth === 1 ? "" : "s"} 🌍
        </div>
      )}

      {records.length > 0 && (
        <div>
          <SectionLabel>Records</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {records.map((r) => (
              <RecordCard key={r.title} {...r} />
            ))}
          </div>
        </div>
      )}

      {stats.mostVisitedAirports.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-medium text-slate-500">Most visited airports</div>
          <div className="flex flex-wrap gap-2">
            {stats.mostVisitedAirports.map((a) => (
              <span key={a.code} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {a.code} <span className="text-slate-400">×{a.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.flightsByYear.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-medium text-slate-500">Flights by year</div>
          <div className="space-y-1.5">
            {stats.flightsByYear.map((y) => (
              <div key={y.year} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-10 shrink-0 font-mono">{y.year}</span>
                <div className="h-3.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-3.5 rounded-full bg-[#2a78d6]"
                    style={{ width: `${Math.max(6, (y.count / maxYearCount) * 100)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-ink">{y.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
