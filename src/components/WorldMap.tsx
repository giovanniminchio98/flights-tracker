import { useMemo, useRef, useState } from "react";
import type { FlightRecord } from "@/types";
import { getAirport, isKnownAirport } from "@/lib/airports";
import { getLandPath, project, MAP_WIDTH, MAP_HEIGHT } from "@/lib/worldMap";
import { formatDateTime } from "@/lib/dateUtils";

const PAST_COLOR = "#2a78d6"; // categorical slot 1 (blue) — validated CVD-safe with slot 2
const UPCOMING_COLOR = "#eb6834"; // categorical slot 2 (orange)

interface RouteTooltip {
  type: "route";
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  when: string;
  isPast: boolean;
}

interface AirportTooltip {
  type: "airport";
  code: string;
  name: string;
  count: number;
}

type TooltipContent = RouteTooltip | AirportTooltip;

function shortestLonDelta(lon1: number, lon2: number): number {
  let d = lon2 - lon1;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function arcPath([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const offset = Math.min(dist * 0.15, 60);
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (x1 + x2) / 2 + nx * offset;
  const cy = (y1 + y2) / 2 + ny * offset;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** Splits a route at the antimeridian when the shorter direction crosses it,
 * so trans-Pacific routes wrap off one edge and back in the other instead of
 * drawing a straight line across the whole map. */
function buildRoutePaths(from: [number, number], to: [number, number]): string[] {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const delta = shortestLonDelta(lon1, lon2);
  const wrappedLon2 = lon1 + delta;

  if (wrappedLon2 >= -180 && wrappedLon2 <= 180) {
    return [arcPath(project(from), project(to))];
  }

  const edgeLon = wrappedLon2 > 180 ? 180 : -180;
  const otherEdgeLon = edgeLon === 180 ? -180 : 180;
  const t = (edgeLon - lon1) / delta;
  const crossLat = lat1 + (lat2 - lat1) * t;

  return [
    arcPath(project(from), project([edgeLon, crossLat])),
    arcPath(project([otherEdgeLon, crossLat]), project(to)),
  ];
}

export interface WorldMapProps {
  flights: FlightRecord[];
  /** When set, this flight is drawn on top at full strength and every other
   * route/airport is dimmed — the "tap a flight, it lights up" behavior. */
  highlightedId?: string | null;
  /** Optional predicate to fade routes that don't match the current Passport
   * stat filter (e.g. only flights touching a country/airport). */
  routeFilter?: (flight: FlightRecord) => boolean;
  /** CSS height for the map's aspect box. */
  heightClass?: string;
  onSelectFlight?: (id: string) => void;
}

export function WorldMap({
  flights,
  highlightedId,
  routeFilter,
  heightClass = "aspect-[960/460]",
  onSelectFlight,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ content: TooltipContent; x: number; y: number } | null>(null);

  const landPath = useMemo(() => getLandPath(), []);
  const now = Date.now();

  const routes = useMemo(() => {
    return flights
      .filter((f) => isKnownAirport(f.departureAirport) && isKnownAirport(f.arrivalAirport))
      .map((f) => {
        const from = getAirport(f.departureAirport)!;
        const to = getAirport(f.arrivalAirport)!;
        const isPast = new Date(f.departureTime).getTime() < now;
        const paths = buildRoutePaths([from.lon, from.lat], [to.lon, to.lat]);
        const matchesFilter = routeFilter ? routeFilter(f) : true;
        return { flight: f, paths, isPast, matchesFilter };
      });
  }, [flights, now, routeFilter]);

  const airports = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flights) {
      for (const code of [f.departureAirport, f.arrivalAirport]) {
        if (!isKnownAirport(code)) continue;
        const key = code.toUpperCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([code, count]) => ({
      code,
      count,
      info: getAirport(code)!,
      point: project([getAirport(code)!.lon, getAirport(code)!.lat]),
    }));
  }, [flights]);

  function showTooltip(e: { clientX: number; clientY: number }, content: TooltipContent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ content, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const hasHighlight = Boolean(highlightedId);

  function routeOpacity(flightId: string, matchesFilter: boolean): number {
    if (hasHighlight) return flightId === highlightedId ? 1 : 0.12;
    return matchesFilter ? 0.9 : 0.1;
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className={`w-full ${heightClass}`}
        onMouseLeave={() => setTooltip(null)}
      >
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#dbe2ee" />
        <path d={landPath} fill="#9fb0c9" fillRule="evenodd" />

        {/* non-highlighted routes first, highlighted route drawn last (on top) */}
        {routes
          .slice()
          .sort((a, b) => {
            const aTop = a.flight.id === highlightedId ? 1 : 0;
            const bTop = b.flight.id === highlightedId ? 1 : 0;
            return aTop - bTop;
          })
          .map(({ flight, paths, isPast, matchesFilter }) =>
            paths.map((d, i) => {
              const opacity = routeOpacity(flight.id, matchesFilter);
              const isActive = flight.id === highlightedId;
              return (
                <g key={`${flight.id}-${i}`} style={{ opacity }}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isPast ? PAST_COLOR : UPCOMING_COLOR}
                    strokeWidth={isActive ? 3 : 2}
                    strokeLinecap="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ pointerEvents: "stroke", cursor: onSelectFlight ? "pointer" : "default" }}
                    onClick={() => onSelectFlight?.(flight.id)}
                    onMouseMove={(e) =>
                      showTooltip(e, {
                        type: "route",
                        flightNumber: flight.flightNumber,
                        airline: flight.airline,
                        from: flight.departureAirport,
                        to: flight.arrivalAirport,
                        when: formatDateTime(flight.departureTime),
                        isPast,
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                </g>
              );
            })
          )}

        {airports.map((a) => (
          <g key={a.code} style={{ opacity: hasHighlight ? 0.3 : 1 }}>
            <circle cx={a.point[0]} cy={a.point[1]} r={3.5} fill="#0b1524" stroke="#dbe2ee" strokeWidth={1.5} />
            <circle
              cx={a.point[0]}
              cy={a.point[1]}
              r={9}
              fill="transparent"
              onMouseMove={(e) => showTooltip(e, { type: "airport", code: a.code, name: a.info.name, count: a.count })}
              onMouseLeave={() => setTooltip(null)}
            />
          </g>
        ))}
      </svg>

      {routes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
            Add a flight to see it on the map
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 0) - 160), top: tooltip.y + 12 }}
        >
          {tooltip.content.type === "route" ? (
            <>
              <div className="font-medium">
                {tooltip.content.from} → {tooltip.content.to}
              </div>
              <div className="text-slate-300">
                {tooltip.content.airline} {tooltip.content.flightNumber} · {tooltip.content.when}
              </div>
              <div className="text-slate-400">{tooltip.content.isPast ? "Past" : "Upcoming"}</div>
            </>
          ) : (
            <>
              <div className="font-medium">{tooltip.content.code}</div>
              <div className="text-slate-300">{tooltip.content.name}</div>
              <div className="text-slate-400">
                {tooltip.content.count} flight{tooltip.content.count === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
