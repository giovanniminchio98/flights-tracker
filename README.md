# flights-tracker

A personal, Flighty-style flight tracker — a static site (Vite + React +
TypeScript), deployed on GitHub Pages via GitHub Actions, no backend of any
kind. Flights are stored in your browser's `localStorage`.

## Current state: standalone, manual add with two speed-ups

Right now the app doesn't touch Google Calendar or iCloud — you add flights
by hand, but the add flow is built to minimize typing:

1. **Type the flight number.** If you've logged that exact number before,
   pressing Enter jumps straight to a **date-only** step: the route is
   filled in from your history, and you just tap **Today** / **Tomorrow** /
   pick a date. Times are derived from your past entry's clock time and
   flight duration.
2. **A number you haven't logged before** either:
   - looks itself up automatically via the optional **AeroDataBox API**
     (see below) — pick a date, it fetches the real route and scheduled
     times, you confirm and it's saved; or
   - if no API key is configured, falls back to a manual form (route +
     exact times, one time only for that flight number).

Everything (added flights, the optional API key) lives in this browser's
`localStorage`. Nothing is synced anywhere; clearing site data clears it.

### Optional: automatic lookup via AeroDataBox

Click **"Flight lookup API"** (top right) to add a RapidAPI key for
[AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox). Sign up at
rapidapi.com, subscribe to AeroDataBox's free plan, and paste the key in —
it enables automatic route/schedule lookup for flight numbers you haven't
logged before.

Two things worth knowing before you do this:

- **This is a real third-party flight-data API** — a deliberate exception
  to this project's original "no flight APIs" scope, added because typing
  a route by hand for every new flight number was the alternative.
- **The key can't be hidden.** There's no backend here, so the key is
  stored in your browser and sent directly from it on every lookup —
  visible to anyone with DevTools access to this device. Fine for a
  personal key on a small free tier; don't reuse a key you care more about.
- This integration (`src/lib/flightLookup.ts`) was written from
  AeroDataBox's documented response shape, not verified against a live
  call (no key and no network path to RapidAPI were available while
  building it). If a real lookup fails to parse correctly, the exact error
  shown (or the raw response) is what's needed to fix it.

## Google Calendar sync / iCloud `.ics` import: built, not wired in

An earlier phase of this project built full client-side Google Calendar
auto-sync (via Google Identity Services, no client secret) writing to a
Google Sheet, plus iCloud calendar import via `.ics` file upload, with
cross-source dedup (primary key: flight number + departure date; secondary
key: source + calendar event id). That code still exists —
`src/lib/googleAuth.ts`, `googleCalendar.ts`, `googleSheets.ts`, `sync.ts`,
`icsParser.ts`, and the `SetupScreen` / `LoginScreen` / `Settings` /
`SyncButton` / `IcsImportPanel` components — but `App.tsx` doesn't currently
render any of it; the app fell back to local-only storage to get a
guaranteed-working baseline after a deploy issue. Reconnecting it is a
follow-up, not a rebuild.

## Stack

Vite + React + TypeScript, Tailwind for styling. `npm run build` produces
static files in `dist/`; that's the entire deployable artifact.

## Setup

### 1. Enable GitHub Pages for this repo

One-time, in the repo's **Settings → Pages**: set **Build and
deployment → Source** to **GitHub Actions**. The included workflow
(`.github/workflows/deploy.yml`) then builds and deploys automatically on
every push to `main`.

### 2. Run it

Locally:

```
npm install
npm run dev
```

Open the printed `localhost` URL and use it — "+ Add flight" is all you
need. Optionally click "Flight lookup API" to add an AeroDataBox key (see
above).

On GitHub Pages: once the Actions workflow has deployed, open
`https://<your-github-username>.github.io/flights-tracker/`.

## Known limitations

- Nothing is synced across devices or browsers — this is intentionally a
  single-browser, local-only store for now.
- The "miles flown" stat only counts routes between airports in the small
  curated coordinate list in `src/lib/airports.ts`; unlisted airports
  still count as a segment but not toward mileage.
- Automatic lookup for new flight numbers requires an AeroDataBox API key
  (see above) and hasn't been verified against a live response.
- `npm audit` flags one moderate/high advisory in `esbuild`, nested inside
  Vite's dev server tooling (GHSA-67mh-4wv8-2f99). It only affects
  `npm run dev` (a malicious site could in theory read local dev-server
  responses while it's running) — it has no effect on the production
  static build served by GitHub Pages. The fix requires a Vite major
  version bump; not worth the churn for a personal project at this point.
