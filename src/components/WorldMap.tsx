import { useEffect, useMemo, useRef, useState } from "react";
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

interface Segment {
  d: string;
  /** midpoint of the curve + travel angle (deg), for the direction arrow */
  mx: number;
  my: number;
  angle: number;
}

function arcPath([x1, y1]: [number, number], [x2, y2]: [number, number]): Segment {
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
  // Quadratic midpoint (t=0.5); its tangent direction equals the chord p0→p1.
  const mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const my = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
    mx,
    my,
    angle,
  };
}

/** Splits a route at the antimeridian when the shorter direction crosses it,
 * so trans-Pacific routes wrap off one edge and back in the other instead of
 * drawing a straight line across the whole map. */
function buildRoutePaths(from: [number, number], to: [number, number]): Segment[] {
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

  // Target camera (scale + translate) that frames the highlighted flight's
  // route; null => full world view. Selecting a flight zooms in, deselecting
  // returns to the whole map.
  const focus = useMemo(() => {
    if (!highlightedId) return null;
    const f = flights.find((x) => x.id === highlightedId);
    if (!f || !isKnownAirport(f.departureAirport) || !isKnownAirport(f.arrivalAirport)) return null;
    const a = project([getAirport(f.departureAirport)!.lon, getAirport(f.departureAirport)!.lat]);
    const b = project([getAirport(f.arrivalAirport)!.lon, getAirport(f.arrivalAirport)!.lat]);
    let minX = Math.min(a[0], b[0]);
    let maxX = Math.max(a[0], b[0]);
    let minY = Math.min(a[1], b[1]);
    let maxY = Math.max(a[1], b[1]);
    const padX = Math.max((maxX - minX) * 0.45, 90);
    const padY = Math.max((maxY - minY) * 0.45, 90);
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const s = Math.max(1, Math.min(Math.min(MAP_WIDTH / bw, MAP_HEIGHT / bh), 5));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { s, tx: MAP_WIDTH / 2 - s * cx, ty: MAP_HEIGHT / 2 - s * cy };
  }, [highlightedId, flights]);

  // Animate the camera toward `focus` with a rAF ease (SVG transform attrs
  // don't transition via CSS reliably, so we interpolate directly).
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const target = focus ?? { s: 1, tx: 0, ty: 0 };
    const start = { ...viewRef.current };
    const t0 = performance.now();
    const dur = 600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setView({
        s: start.s + (target.s - start.s) * e,
        tx: start.tx + (target.tx - start.tx) * e,
        ty: start.ty + (target.ty - start.ty) * e,
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const sceneTransform = `translate(${view.tx.toFixed(2)} ${view.ty.toFixed(2)}) scale(${view.s.toFixed(4)})`;
  const invScale = 1 / view.s; // keep dot sizes constant while zoomed

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
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0b1626" />

        <g transform={sceneTransform}>
          <path d={landPath} fill="#22304a" fillRule="evenodd" />

          {/* non-highlighted routes first, highlighted route drawn last (on top) */}
          {routes
            .slice()
            .sort((a, b) => {
              const aTop = a.flight.id === highlightedId ? 1 : 0;
              const bTop = b.flight.id === highlightedId ? 1 : 0;
              return aTop - bTop;
            })
            .map(({ flight, paths, isPast, matchesFilter }) =>
              paths.map((seg, i) => {
                const opacity = routeOpacity(flight.id, matchesFilter);
                const isActive = flight.id === highlightedId;
                const color = isPast ? PAST_COLOR : UPCOMING_COLOR;
                const ah = 5 * invScale; // arrowhead half-size, constant on screen
                return (
                  <g key={`${flight.id}-${i}`} style={{ opacity }}>
                    <path
                      d={seg.d}
                      fill="none"
                      stroke={color}
                      strokeWidth={isActive ? 3 : 2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* direction arrow at the segment midpoint (departure → arrival) */}
                    <path
                      d={`M ${-ah},${-ah} L ${ah},0 L ${-ah},${ah} Z`}
                      fill={color}
                      transform={`translate(${seg.mx} ${seg.my}) rotate(${seg.angle})`}
                    />
                    <path
                      d={seg.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      vectorEffect="non-scaling-stroke"
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
            <g key={a.code} style={{ opacity: hasHighlight ? 0.35 : 1 }}>
              <circle
                cx={a.point[0]}
                cy={a.point[1]}
                r={3.5 * invScale}
                fill="#dbe4f2"
                stroke="#0b1626"
                strokeWidth={1.5 * invScale}
              />
              <circle
                cx={a.point[0]}
                cy={a.point[1]}
                r={9 * invScale}
                fill="transparent"
                onMouseMove={(e) => showTooltip(e, { type: "airport", code: a.code, name: a.info.name, count: a.count })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          ))}
        </g>
      </svg>

      {hasHighlight && (
        <button
          onClick={() => onSelectFlight?.(highlightedId!)}
          className="absolute right-3 top-3 z-10 rounded-full bg-surface/90 px-3 py-1 text-xs text-ink shadow-sm hover:bg-surface"
        >
          Reset view ✕
        </button>
      )}

      {routes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-surface/80 px-3 py-1.5 text-xs text-muted shadow-sm">
            Add a flight to see it on the map
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-line bg-surface2 px-3 py-2 text-xs text-ink shadow-lg"
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
              <div className="text-muted">{tooltip.content.isPast ? "Past" : "Upcoming"}</div>
            </>
          ) : (
            <>
              <div className="font-medium">{tooltip.content.code}</div>
              <div className="text-slate-300">{tooltip.content.name}</div>
              <div className="text-muted">
                {tooltip.content.count} flight{tooltip.content.count === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
