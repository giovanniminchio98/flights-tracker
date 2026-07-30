import type { Units } from "./localConfig";

const KM_PER_MI = 1.609344;

export function kmToDisplay(km: number, units: Units): number {
  return units === "mi" ? km / KM_PER_MI : km;
}

/** Formats a canonical kilometre value in the chosen unit with a thousands
 * separator and the unit suffix, e.g. formatDistance(1609, "mi") -> "1,000 mi". */
export function formatDistance(km: number, units: Units): string {
  const value = Math.round(kmToDisplay(km, units));
  return `${value.toLocaleString()} ${units}`;
}

/** Distance with no unit suffix (for tight stat tiles that label the unit separately). */
export function formatDistanceValue(km: number, units: Units): string {
  return Math.round(kmToDisplay(km, units)).toLocaleString();
}

export function unitLabel(units: Units): string {
  return units;
}

/** Turns an ISO 3166-1 alpha-2 country code into its flag emoji via regional
 * indicator symbols — no lookup table needed. Returns "" for invalid input. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  const base = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65));
}
