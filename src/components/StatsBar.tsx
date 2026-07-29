import type { FlightStats } from "@/lib/stats";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export function StatsBar({ stats }: { stats: FlightStats }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Flights this year" value={stats.flightsThisYear} />
        <Stat label="Total segments" value={stats.totalSegments} />
        <Stat label="Miles this year" value={stats.milesThisYear.toLocaleString()} />
        <Stat label="Miles all-time" value={stats.milesAllTime.toLocaleString()} />
      </div>
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
    </div>
  );
}
