import { useEffect, useMemo, useRef, useState } from "react";
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoInterpolate,
  type GeoProjection,
} from "d3-geo";
import type { Feature, LineString } from "geojson";
import type { FlightRecord } from "@/types";
import { getAirport, isKnownAirport } from "@/lib/airports";
import { getLandFeature } from "@/lib/worldMap";
import { formatDateShort } from "@/lib/dateUtils";

const PAST = "#2a78d6";
const UPCOMING = "#eb6834";

type FilterMode = "all" | "upcoming" | "past";

interface Arc {
  line: Feature<LineString>;
  color: string;
  mid: [number, number]; // lon/lat midpoint for the label + direction arrow
  ahead: [number, number]; // a lon/lat point just past the midpoint (travel direction)
  routeLabel: string; // "HEL → JFK"
  dateLabel: string; // "Fri, 31 Jul"
}

/** Builds a great-circle LineString (sampled) between two airports so
 * d3-geo can render it curved and correctly clip the half hidden behind
 * the globe. */
function greatCircle(from: [number, number], to: [number, number]): Feature<LineString> {
  const interp = geoInterpolate(from, to);
  const n = 48;
  const coords: [number, number][] = [];
  for (let i = 0; i <= n; i++) coords.push(interp(i / n) as [number, number]);
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
}

export function GlobeView({
  flights,
  onClose,
}: {
  flights: FlightRecord[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FilterMode>("all");

  const now = Date.now();
  const land = useMemo(() => getLandFeature(), []);
  const graticule = useMemo(() => geoGraticule10(), []);

  const filtered = useMemo(
    () =>
      flights.filter((f) => {
        if (!isKnownAirport(f.departureAirport) || !isKnownAirport(f.arrivalAirport)) return false;
        const past = new Date(f.arrivalTime).getTime() < now;
        if (mode === "upcoming") return !past;
        if (mode === "past") return past;
        return true;
      }),
    [flights, mode, now]
  );

  const arcs = useMemo<Arc[]>(
    () =>
      filtered.map((f) => {
        const a = getAirport(f.departureAirport)!;
        const b = getAirport(f.arrivalAirport)!;
        const past = new Date(f.arrivalTime).getTime() < now;
        const interp = geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
        const mid = interp(0.5) as [number, number];
        const ahead = interp(0.56) as [number, number];
        return {
          line: greatCircle([a.lon, a.lat], [b.lon, b.lat]),
          color: past ? PAST : UPCOMING,
          mid,
          ahead,
          routeLabel: `${f.departureAirport.toUpperCase()} → ${f.arrivalAirport.toUpperCase()}`,
          dateLabel: formatDateShort(f.departureTime),
        };
      }),
    [filtered, now]
  );

  const points = useMemo(() => {
    const set = new Map<string, [number, number]>();
    for (const f of filtered) {
      for (const code of [f.departureAirport, f.arrivalAirport]) {
        const info = getAirport(code);
        if (info) set.set(code.toUpperCase(), [info.lon, info.lat]);
      }
    }
    return Array.from(set.entries()).map(([code, p]) => ({ code, p }));
  }, [filtered]);

  // Rotation + scale live in refs so the animation loop reads the latest
  // without re-subscribing; React state only drives the filter UI.
  const rotationRef = useRef<[number, number]>([0, -20]);
  const scaleRef = useRef(1); // multiplier on the fit-to-container base scale
  const draggingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef<[number, number]>([0.06, 0]); // idle auto-spin (deg/frame)
  const projectionRef = useRef<GeoProjection | null>(null);
  // Active touch/pointer tracking so two-finger pinch can zoom on mobile.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;

    let width = 0;
    let height = 0;
    let baseScale = 1;
    const projection = geoOrthographic().clipAngle(90).precision(0.4);
    projectionRef.current = projection;
    const path = geoPath(projection, ctx);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseScale = Math.min(width, height) / 2 - 12;
      projection.translate([width / 2, height / 2]);
    }

    function draw() {
      projection.rotate([rotationRef.current[0], rotationRef.current[1]]);
      projection.scale(baseScale * scaleRef.current);
      ctx.clearRect(0, 0, width, height);

      // Ocean sphere
      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.fillStyle = "#0b1626";
      ctx.fill();

      // Graticule
      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Land
      ctx.beginPath();
      path(land);
      ctx.fillStyle = "#22304a";
      ctx.fill();

      // Sphere outline
      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arcs
      ctx.lineWidth = 1.5;
      for (const arc of arcs) {
        ctx.beginPath();
        path(arc.line);
        ctx.strokeStyle = arc.color;
        ctx.stroke();
      }

      const r = rotationRef.current;

      // Direction arrows at each arc midpoint (front hemisphere only)
      for (const arc of arcs) {
        if (!isFront(arc.mid[0], arc.mid[1], -r[0], -r[1])) continue;
        const m = projection(arc.mid);
        const a = projection(arc.ahead);
        if (!m || !a) continue;
        const angle = Math.atan2(a[1] - m[1], a[0] - m[0]);
        ctx.save();
        ctx.translate(m[0], m[1]);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(5, 0);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fillStyle = arc.color;
        ctx.fill();
        ctx.restore();
      }

      // Airport dots + code labels (front hemisphere only). Codes shown when
      // there aren't too many, or once zoomed in, to avoid clutter.
      const showCodes = scaleRef.current >= 1.3 || points.length <= 12;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "600 10px ui-monospace, Menlo, monospace";
      for (const { code, p } of points) {
        const [lon, lat] = p;
        if (!isFront(lon, lat, -r[0], -r[1])) continue;
        const xy = projection(p);
        if (!xy) continue;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#dbe4f2";
        ctx.fill();
        if (showCodes) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(10,17,32,0.85)";
          ctx.strokeText(code, xy[0] + 5, xy[1]);
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(code, xy[0] + 5, xy[1]);
        }
      }

      // Per-flight labels near each arc's midpoint (front hemisphere only).
      // Suppressed when zoomed far out with many flights to avoid clutter.
      const showLabels = scaleRef.current >= 1.4 || arcs.length <= 8;
      if (showLabels) {
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        for (const arc of arcs) {
          if (!isFront(arc.mid[0], arc.mid[1], -r[0], -r[1])) continue;
          const xy = projection(arc.mid);
          if (!xy) continue;
          const [x, y] = xy;

          ctx.font = "600 11px ui-monospace, Menlo, monospace";
          const routeW = ctx.measureText(arc.routeLabel).width;
          ctx.font = "10px ui-monospace, Menlo, monospace";
          const dateW = ctx.measureText(arc.dateLabel).width;
          const boxW = Math.max(routeW, dateW) + 12;
          const boxH = 30;
          const boxX = x - boxW / 2;
          const boxY = y - boxH - 8;

          // backing pill for legibility over land/ocean
          ctx.fillStyle = "rgba(10,17,32,0.82)";
          roundRect(ctx, boxX, boxY, boxW, boxH, 6);
          ctx.fill();

          ctx.fillStyle = "#e7ecf6";
          ctx.font = "600 11px ui-monospace, Menlo, monospace";
          ctx.fillText(arc.routeLabel, x, boxY + 15);
          ctx.fillStyle = "#93a1bd";
          ctx.font = "10px ui-monospace, Menlo, monospace";
          ctx.fillText(arc.dateLabel, x, boxY + 27);
        }
      }
    }

    function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
      c.beginPath();
      c.moveTo(x + radius, y);
      c.arcTo(x + w, y, x + w, y + h, radius);
      c.arcTo(x + w, y + h, x, y + h, radius);
      c.arcTo(x, y + h, x, y, radius);
      c.arcTo(x, y, x + w, y, radius);
      c.closePath();
    }

    let raf = 0;
    function tick() {
      if (!draggingRef.current) {
        rotationRef.current = [
          rotationRef.current[0] + velocityRef.current[0],
          Math.max(-90, Math.min(90, rotationRef.current[1] + velocityRef.current[1])),
        ];
        // decay any drag-thrown velocity toward the gentle idle spin
        velocityRef.current = [
          velocityRef.current[0] * 0.95 + 0.06 * 0.05,
          velocityRef.current[1] * 0.9,
        ];
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // arcs/points/land/graticule captured by closure; re-run when arcs change
  }, [arcs, points, land, graticule]);

  // One finger = spin; two fingers = pinch-zoom (works on mobile); wheel =
  // zoom on desktop.
  function onPointerDown(e: React.PointerEvent) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      draggingRef.current = true;
      lastRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // second finger down — stop spinning, start pinch
      draggingRef.current = false;
      pinchDistRef.current = null;
    }
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointersRef.current.values());

    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistRef.current != null && pinchDistRef.current > 0) {
        const factor = d / pinchDistRef.current;
        scaleRef.current = Math.max(0.6, Math.min(6, scaleRef.current * factor));
      }
      pinchDistRef.current = d;
      return;
    }

    if (!draggingRef.current || !lastRef.current) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    const k = 0.3 / scaleRef.current;
    const r = rotationRef.current;
    rotationRef.current = [r[0] + dx * k, Math.max(-90, Math.min(90, r[1] - dy * k))];
    velocityRef.current = [dx * k * 0.6, -dy * k * 0.6];
  }
  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchDistRef.current = null;
    if (pointersRef.current.size === 1) {
      const [p] = Array.from(pointersRef.current.values());
      lastRef.current = { x: p.x, y: p.y };
      draggingRef.current = true;
    } else if (pointersRef.current.size === 0) {
      draggingRef.current = false;
      lastRef.current = null;
    }
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function onWheel(e: React.WheelEvent) {
    const next = scaleRef.current * (e.deltaY < 0 ? 1.1 : 0.9);
    scaleRef.current = Math.max(0.6, Math.min(6, next));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper">
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <span className="font-semibold text-ink">Explore the globe</span>
        <button
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1 text-sm text-muted hover:bg-white/10"
        >
          Close ✕
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2 text-xs">
        {(["all", "upcoming", "past"] as FilterMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 capitalize transition ${
              mode === m ? "bg-accent text-white" : "bg-white/10 text-muted hover:bg-white/20"
            }`}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-muted">
          {filtered.length} flight{filtered.length === 1 ? "" : "s"} · drag to spin · pinch / scroll to zoom
        </span>
      </div>

      <div ref={wrapRef} className="relative flex-1 touch-none">
        <canvas
          ref={canvasRef}
          className="block cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
        />
        {filtered.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg bg-surface/80 px-3 py-1.5 text-xs text-muted">No flights to show for this filter</div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/80 px-3 py-1 text-xs text-muted">
          <span className="text-[#eb6834]">●</span> upcoming <span className="ml-2 text-[#2a78d6]">●</span> past
        </div>
      </div>
    </div>
  );
}

/** Cheap front-hemisphere test for a lon/lat given the projection's rotation
 * center (in degrees). Avoids drawing airport dots on the far side. */
function isFront(lon: number, lat: number, centerLon: number, centerLat: number): boolean {
  const toRad = Math.PI / 180;
  const p = [
    Math.cos(lat * toRad) * Math.cos(lon * toRad),
    Math.cos(lat * toRad) * Math.sin(lon * toRad),
    Math.sin(lat * toRad),
  ];
  const c = [
    Math.cos(centerLat * toRad) * Math.cos(centerLon * toRad),
    Math.cos(centerLat * toRad) * Math.sin(centerLon * toRad),
    Math.sin(centerLat * toRad),
  ];
  return p[0] * c[0] + p[1] * c[1] + p[2] * c[2] > 0;
}
