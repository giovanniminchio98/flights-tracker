/** Single source of truth for the colors used in canvas/SVG drawing, which
 * can't reach Tailwind classes. Keep these in step with tailwind.config.js —
 * a graphite base with a few saturated neons used as signal, not decoration. */

export const COLORS = {
  paper: "#0b0b0d",
  surface: "#141417",
  line: "#2a2a31",
  ink: "#ededf0",
  muted: "#8b8b96",

  neonGreen: "#39ff88",
  neonRed: "#ff2e5b",
  neonViolet: "#b16cff",
  neonYellow: "#ffd93d",
  neonCyan: "#22e0ff",
} as const;

/** Map/globe surfaces. The ocean sits just off the page background so the
 * map reads as its own panel; land is a lifted graphite. */
export const MAP_OCEAN = "#0e0e12";
export const MAP_LAND = "#232329";
export const MAP_LAND_EDGE = "#33333c";

/** Route colors. Upcoming is the loud one (cyan); past recedes to violet.
 * Both stay legible against the graphite land and are distinguishable for
 * the common forms of colour-vision deficiency. */
export const UPCOMING_COLOR = COLORS.neonCyan;
export const PAST_COLOR = COLORS.neonViolet;

/** Airport dots and their halo against the map. */
export const AIRPORT_FILL = COLORS.ink;
export const AIRPORT_STROKE = MAP_OCEAN;
