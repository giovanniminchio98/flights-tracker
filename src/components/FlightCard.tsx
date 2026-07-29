import type { FlightRecord } from "@/types";

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  google: { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-200" },
  icloud: { label: "iCloud", className: "bg-slate-100 text-slate-600 border-slate-300" },
  manual: { label: "Manual", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

function formatDateTime(iso: string): string {
  if (!iso) return "Unknown time";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FlightCard({
  flight,
  onDelete,
}: {
  flight: FlightRecord;
  onDelete: (id: string) => void;
}) {
  const sources = flight.sources
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{flight.airline || "Unknown airline"}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
              {flight.flightNumber}
            </span>
          </div>
          <div className="mt-1 text-lg font-medium text-ink">
            {flight.departureAirport || "???"}
            <span className="mx-2 text-slate-400">→</span>
            {flight.arrivalAirport || "???"}
          </div>
          <div className="mt-1 text-sm text-slate-500">{formatDateTime(flight.departureTime)}</div>
          {flight.confirmationCode && (
            <div className="mt-1 text-xs text-slate-400">Confirmation: {flight.confirmationCode}</div>
          )}
        </div>
        <button
          onClick={() => onDelete(flight.id)}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label="Delete flight"
        >
          Delete
        </button>
      </div>
      <div className="mt-3 flex gap-1.5">
        {sources.map((source) => {
          const badge = SOURCE_BADGES[source] ?? { label: source, className: "bg-slate-100 text-slate-600 border-slate-300" };
          return (
            <span key={source} className={`rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>
              {badge.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
