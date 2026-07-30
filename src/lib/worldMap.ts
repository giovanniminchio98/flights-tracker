import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from "geojson";
// 110m-resolution land-mass outline (~55KB) — plenty for a small flat map,
// bundled at build time so there's no runtime fetch to any map provider.
import landTopology from "world-atlas/land-110m.json";

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 460;

/** Plate carree / equirectangular projection: linear in both axes, which is
 * exactly what "a flat map is fine" calls for — no map-tile service, no
 * external requests, just lon/lat scaled onto a fixed canvas. */
export function project([lon, lat]: Position): [number, number] {
  const x = (lon + 180) * (MAP_WIDTH / 360);
  const y = (90 - lat) * (MAP_HEIGHT / 180);
  return [x, y];
}

function ringToPath(ring: Position[]): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project([lon, lat]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + "Z"
  );
}

function geometryToPath(geometry: Geometry): string {
  if (geometry.type === "Polygon") {
    return (geometry as Polygon).coordinates.map(ringToPath).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry as MultiPolygon).coordinates.map((polygon) => polygon.map(ringToPath).join(" ")).join(" ");
  }
  return "";
}

let cachedLandPath: string | null = null;

/** A single SVG path `d` string covering every land mass, evenodd-filled
 * (so lake/inlet holes at this resolution render correctly). Computed once
 * and cached — the topology never changes at runtime. */
export function getLandPath(): string {
  if (cachedLandPath) return cachedLandPath;

  const topology = landTopology as unknown as Topology;
  const landObject = topology.objects.land as GeometryCollection;
  const result = feature(topology, landObject) as Feature<Geometry> | FeatureCollection<Geometry>;

  const geometries: Geometry[] =
    result.type === "FeatureCollection" ? result.features.map((f) => f.geometry) : [result.geometry];

  cachedLandPath = geometries.map(geometryToPath).join(" ");
  return cachedLandPath;
}

let cachedLandFeature: Feature<Geometry> | null = null;

/** The land mass as a single GeoJSON Feature (MultiPolygon), for rendering
 * with d3-geo's geoPath on the interactive globe (which needs real GeoJSON
 * geometry, not the pre-projected SVG path used by the flat map). */
export function getLandFeature(): Feature<Geometry> {
  if (cachedLandFeature) return cachedLandFeature;
  const topology = landTopology as unknown as Topology;
  const landObject = topology.objects.land as GeometryCollection;
  const result = feature(topology, landObject);
  cachedLandFeature = (result.type === "FeatureCollection" ? result.features[0] : result) as Feature<Geometry>;
  return cachedLandFeature;
}
