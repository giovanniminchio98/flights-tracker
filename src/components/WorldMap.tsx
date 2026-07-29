import { useMemo, useRef, useState } from "react";
import type { FlightRecord } from "@/types";
import { AIRPORTS, isKnownAirport } from "@/lib/airports";
import { getLandPath, project, MAP_WIDTH, MAP_HEIGHT } from "@/lib/worldMap";
import { formatDateTime } from "@/lib/dateUtils";

const PAST_COLOR = "#2a78d6"; // categorical slot 1 (blue) — validated CVD-safe pair with slot 2
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

/** A gentle bow between two already-projected points, always arcing toward
 * the top of the map, so routes read as flight paths rather than straight
 * rulers laid over the globe. */
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

/** Builds one or two path segments for a route between two lon/lat points,
 * splitting at the antimeridian when the shorter direction crosses it —
 * otherwise a trans-Pacific route would draw as a straight line across the
 * entire map instead of wrapping off one edge and back in the other. */
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

export function WorldMap({ flights }: { flights: FlightRecord[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ content: TooltipContent; x: number; y: number } | null>(null);

  const landPath = useMemo(() => getLandPath(), []);
  const now = Date.now();

  const routes = useMemo(() => {
    return flights
      .filter((f) => isKnownAirport(f.departureAirport) && isKnownAirport(f.arrivalAirport))
      .map((f) => {
        const from = AIRPORTS[f.departureAirport.toUpperCase()];
        const to = AIRPORTS[f.arrivalAirport.toUpperCase()];
        const isPast = new Date(f.departureTime).getTime() < now;
        const paths = buildRoutePaths([from.lon, from.lat], [to.lon, to.lat]);
        return { flight: f, paths, isPast };
      });
  }, [flights, now]);

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
      info: AIRPORTS[code],
      point: project([AIRPORTS[code].lon, AIRPORTS[code].lat]),
    }));
  }, [flights]);

  function showTooltip(e: { clientX: number; clientY: number }, content: TooltipContent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ content, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  if (routes.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">Where you've been &amp; where you're going</div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: PAST_COLOR }} />
            Past
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: UPCOMING_COLOR }} />
            Upcoming
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full" onMouseLeave={() => setTooltip(null)}>
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f8fafc" />
        <path d={landPath} fill="#e2e8f0" fillRule="evenodd" />

        {routes.map(({ flight, paths, isPast }) =>
          paths.map((d, i) => (
            <g key={`${flight.id}-${i}`}>
              <path d={d} fill="none" stroke={isPast ? PAST_COLOR : UPCOMING_COLOR} strokeWidth={2} strokeLinecap="round" />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke" }}
                onMouseEnter={(e) =>
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
          ))
        )}

        {airports.map((a) => (
          <g key={a.code}>
            <circle cx={a.point[0]} cy={a.point[1]} r={4} fill="#0f172a" stroke="#f8fafc" strokeWidth={2} />
            <circle
              cx={a.point[0]}
              cy={a.point[1]}
              r={8}
              fill="transparent"
              onMouseEnter={(e) =>
                showTooltip(e, { type: "airport", code: a.code, name: a.info.name, count: a.count })
              }
              onMouseMove={(e) =>
                showTooltip(e, { type: "airport", code: a.code, name: a.info.name, count: a.count })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          </g>
        ))}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
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
