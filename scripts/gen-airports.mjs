// Regenerates src/data/airports.json — the bundled IATA airport dataset
// (code -> name/country/continent/lat/lon/timezone) that powers the map and
// distance/stat calculations. Sourced from the OurAirports dataset via the
// `airport-data-js` package, filtered to airports with scheduled service or
// medium/large type so any airport a person realistically flies to resolves.
//
// This is a one-off build step, not part of `npm run build`: the heavy
// (~11MB) source package is intentionally NOT a dependency. To re-run:
//   npm install --no-save airport-data-js && node scripts/gen-airports.mjs
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);

const a = require("airport-data-js");
const CONT = { NA: "North America", SA: "South America", EU: "Europe", AF: "Africa", AS: "Asia", OC: "Oceania", AN: "Antarctica" };

const all = [];
for (const c of Object.keys(CONT)) {
  const list = await a.getAirportByContinent(c);
  if (Array.isArray(list)) all.push(...list);
}

const out = {};
for (const x of all) {
  if (!x.iata || x.iata.length !== 3 || x.latitude == null || x.longitude == null) continue;
  const relevant = x.scheduled_service === "TRUE" || x.type === "large_airport" || x.type === "medium_airport";
  if (!relevant) continue;
  const code = x.iata.toUpperCase();
  if (out[code]) continue;
  out[code] = {
    name: x.airport || code,
    country: x.country_code || "",
    continent: CONT[x.continent] || "",
    lat: Math.round(x.latitude * 10000) / 10000,
    lon: Math.round(x.longitude * 10000) / 10000,
    tz: x.time || "",
  };
}

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/airports.json", JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} airports to src/data/airports.json`);
