import { useEffect, useMemo, useRef, useState } from "react";
import type { FlightRecord } from "@/types";
import { getAirport, isKnownAirport } from "@/lib/airports";
import { getLandPath, project, MAP_WIDTH, MAP_HEIGHT } from "@/lib/worldMap";
import { formatDateTime } from "@/lib/dateUtils";
import {
  PAST_COLOR,
  UPCOMING_COLOR,
  MAP_OCEAN,
  MAP_LAND,
  AIRPORT_FILL,
} from "@/lib/theme";

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

  // Set while a touch/mouse gesture is in progress so the focus animation
  // doesn't fight the user's fingers.
  const gestureRef = useRef(false);

  useEffect(() => {
    const target = focus ?? { s: 1, tx: 0, ty: 0 };
    const start = { ...viewRef.current };
    const t0 = performance.now();
    const dur = 600;
    let raf = 0;
    const tick = (t: number) => {
      if (gestureRef.current) return; // user took over mid-animation
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

  // ---- Manual pan / pinch-zoom -------------------------------------------
  // Pointer Events cover mouse, touch and pen with one code path, so pinch
  // works on phones and wheel/drag works on desktop.
  const MIN_SCALE = 1;
  const MAX_SCALE = 8;
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  // Distinguishes a tap (select a flight) from a drag (pan the map).
  const movedRef = useRef(false);

  /** Clamp so the map can never be dragged away from the viewport. */
  function clampView(v: { s: number; tx: number; ty: number }) {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s));
    const minTx = -(s - 1) * MAP_WIDTH;
    const minTy = -(s - 1) * MAP_HEIGHT;
    return {
      s,
      tx: Math.min(0, Math.max(minTx, v.tx)),
      ty: Math.min(0, Math.max(minTy, v.ty)),
    };
  }

  /** Client coords → viewBox coords, accounting for preserveAspectRatio slice
   * (the viewBox is scaled to cover the box, then centred). */
  function toViewBox(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, k: 1 };
    const k = Math.max(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
    const offX = (rect.width - MAP_WIDTH * k) / 2;
    const offY = (rect.height - MAP_HEIGHT * k) / 2;
    return { x: (clientX - rect.left - offX) / k, y: (clientY - rect.top - offY) / k, k };
  }

  /** Zoom by `factor` while keeping the point under (clientX, clientY) fixed. */
  function zoomAt(factor: number, clientX: number, clientY: number) {
    const { x, y } = toViewBox(clientX, clientY);
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
      // Scene point under the cursor must map to the same viewBox point.
      const sceneX = (x - v.tx) / v.s;
      const sceneY = (y - v.ty) / v.s;
      return clampView({ s, tx: x - s * sceneX, ty: y - s * sceneY });
    });
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;
    gestureRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const pts = pointersRef.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size === 2 && pinchRef.current) {
      // Pinch: scale by the change in finger separation, and pan by the
      // change in their midpoint so the gesture tracks the fingers.
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const start = pinchRef.current;
      if (start.dist > 0) {
        movedRef.current = true;
        const { k } = toViewBox(mid.x, mid.y);
        const dx = (mid.x - start.mid.x) / k;
        const dy = (mid.y - start.mid.y) / k;
        const { x, y } = toViewBox(mid.x, mid.y);
        const factor = dist / start.dist;
        setView((v) => {
          const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
          const sceneX = (x - v.tx) / v.s;
          const sceneY = (y - v.ty) / v.s;
          return clampView({ s, tx: x - s * sceneX + dx, ty: y - s * sceneY + dy });
        });
      }
      pinchRef.current = { dist, mid };
      return;
    }

    if (pts.size === 1) {
      const dxClient = e.clientX - prev.x;
      const dyClient = e.clientY - prev.y;
      if (Math.abs(dxClient) > 2 || Math.abs(dyClient) > 2) movedRef.current = true;
      const { k } = toViewBox(e.clientX, e.clientY);
      setView((v) => clampView({ ...v, tx: v.tx + dxClient / k, ty: v.ty + dyClient / k }));
    }
  }

  function endPointer(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) gestureRef.current = false;
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    // Zoom toward the cursor; trackpad pinch arrives here as ctrlKey+wheel.
    zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
  }

  const zoomed = view.s > 1.01;
  function resetView() {
    gestureRef.current = false;
    setView({ s: 1, tx: 0, ty: 0 });
  }

  const sceneTransform = `translate(${view.tx.toFixed(2)} ${view.ty.toFixed(2)}) scale(${view.s.toFixed(4)})`;
  const invScale = 1 / view.s; // keep dot/label sizes constant while zoomed
  // Airport code labels: shown when there aren't too many, or once zoomed in.
  const showAirportLabels = airports.length <= 14 || view.s >= 1.6;

  function routeOpacity(flightId: string, matchesFilter: boolean): number {
    if (hasHighlight) return flightId === highlightedId ? 1 : 0.12;
    return matchesFilter ? 0.9 : 0.1;
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className={`w-full ${heightClass} ${zoomed ? "cursor-grab" : ""}`}
        // touch-action:none lets us handle pinch/drag ourselves instead of the
        // browser scrolling or page-zooming over the map.
        style={{ touchAction: "none" }}
        onMouseLeave={() => setTooltip(null)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleWheel}
      >
        <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill={MAP_OCEAN} />

        <g transform={sceneTransform}>
          <path d={landPath} fill={MAP_LAND} fillRule="evenodd" />

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
                const ah = 8.5 * invScale; // arrowhead half-size, constant on screen
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
                      onClick={() => {
                        if (movedRef.current) return; // that was a pan, not a tap
                        onSelectFlight?.(flight.id);
                      }}
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
                fill={AIRPORT_FILL}
                stroke={MAP_OCEAN}
                strokeWidth={1.5 * invScale}
              />
              {showAirportLabels && (
                <text
                  x={a.point[0] + 6 * invScale}
                  y={a.point[1] + 3.5 * invScale}
                  fontSize={11 * invScale}
                  fontWeight={600}
                  fill={AIRPORT_FILL}
                  stroke={MAP_OCEAN}
                  strokeWidth={3 * invScale}
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {a.code}
                </text>
              )}
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

      {/* Zoom controls — pinch works on touch, these give the same reach with
       * a mouse and make the map's zoomability discoverable. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-lg border border-line bg-surface/90">
        <button
          onClick={() => {
            const r = containerRef.current?.getBoundingClientRect();
            if (r) zoomAt(1.5, r.left + r.width / 2, r.top + r.height / 2);
          }}
          className="px-2.5 py-1 text-sm text-ink hover:bg-white/10"
          title="Zoom in"
        >
          +
        </button>
        <div className="h-px bg-line" />
        <button
          onClick={() => {
            const r = containerRef.current?.getBoundingClientRect();
            if (r) zoomAt(1 / 1.5, r.left + r.width / 2, r.top + r.height / 2);
          }}
          className="px-2.5 py-1 text-sm text-ink hover:bg-white/10"
          title="Zoom out"
        >
          −
        </button>
      </div>

      {(hasHighlight || zoomed) && (
        <button
          onClick={() => {
            resetView();
            if (hasHighlight) onSelectFlight?.(highlightedId!);
          }}
          className="absolute bottom-3 left-3 z-10 rounded-full bg-surface/90 px-3 py-1 text-xs text-ink shadow-sm hover:bg-surface"
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
              <div className="text-ink">
                {tooltip.content.airline} {tooltip.content.flightNumber} · {tooltip.content.when}
              </div>
              <div className="text-muted">{tooltip.content.isPast ? "Past" : "Upcoming"}</div>
            </>
          ) : (
            <>
              <div className="font-medium">{tooltip.content.code}</div>
              <div className="text-ink">{tooltip.content.name}</div>
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
