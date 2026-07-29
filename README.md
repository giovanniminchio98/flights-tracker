# flights-tracker

A personal, Flighty-style flight tracker that auto-detects flights from your
Google Calendar (the events Gmail auto-creates from airline confirmation
emails) and lets you import your iCloud calendar as an `.ics` file, dedupes
them across both sources, and stores the result in a Google Sheet — no
external database, no flight-status API keys, **no server at all**. It's a
static site, built to run on GitHub Pages.

## How it works

1. **Sync Google now** pulls events from every Google calendar in a `-2y`
   to `+1y` window around today, directly from the browser.
2. **Import iCloud calendar (.ics)** parses an `.ics` file you export from
   Apple Calendar / iCloud, entirely client-side.
3. Both feed the same heuristics (airline code + flight number, keywords
   like "boarding pass", "confirmation code", "PNR", etc.) to decide
   whether an event is a flight and extract `{ airline, flightNumber,
   confirmationCode, departureAirport, arrivalAirport, departureTime,
   arrivalTime }`.
4. Candidates are deduped:
   - **Secondary key** (`source:eventId`) — skip an event that's already
     been synced before.
   - **Primary key** (`flightNumber` + departure date) — the same
     real-world flight, regardless of which calendar it came from. A match
     merges into the existing Sheet row (filling blanks, refreshing times,
     unioning `linkedEventIds`/`sources`) instead of creating a duplicate.
5. Rows live in a Google Sheet named **Flight Tracker** (tab **Flights**),
   created automatically on first sync. Nothing is ever auto-deleted —
   deleting a flight is a manual action from the dashboard.

Non-goals: no live flight status/delays/gates, no third-party flight APIs,
no separate database, no multi-user support.

## Why this is different from a typical Next.js/Vercel build

GitHub Pages only serves static files — there's no server to hold a Google
OAuth **client secret** or to proxy calls to iCloud's CalDAV endpoint
(which blocks direct browser requests). So instead of a server-side OAuth
flow and live CalDAV sync, this app:

- Signs in with Google entirely client-side via **Google Identity
  Services**, using a **public** OAuth Client ID (no secret — that's what
  makes it safe to ship in browser JS). Calendar and Sheets API calls go
  straight from your browser to `googleapis.com` with your access token.
- Replaces live iCloud sync with an **`.ics` file import** — you export
  your iCloud calendar once (or whenever you want fresh data) and upload
  it; the same detection/dedupe logic runs on it in-browser.
- Persists just two small, non-secret values in your browser's
  `localStorage`: your Google Client ID and the auto-created spreadsheet's
  ID. There's no database and no server-side config file, because there's
  no server.

One consequence: Google access tokens issued this way last about an hour
and there's no refresh token (that's inherent to public/browser OAuth
clients), so you may need to click "Sign in with Google" again once in a
while — a fine trade-off for a dashboard you open occasionally.

## Stack

Vite + React + TypeScript, Tailwind for styling, `ical.js` for parsing
`.ics` files in the browser. No backend framework, no Node server at
runtime — `npm run build` produces static files in `dist/` and that's the
entire deployable artifact.

## Setup

### 1. Google Cloud OAuth client (you do this once, yourself)

I can't create this for you — it requires your own Google account.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) →
   create/pick a project.
2. **APIs & Services → Library** → enable **Google Calendar API** and
   **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID** → type **Web application**.
4. Under **Authorized JavaScript origins**, add the origin(s) you'll open
   the app from, e.g.:
   - `https://<your-github-username>.github.io` (GitHub Pages)
   - `http://localhost:5173` (local dev, `npm run dev`)

   No redirect URI and no client secret are needed for this flow.
5. If the OAuth consent screen is in "Testing" mode, add your own Google
   account under **Test users**.
6. Copy the generated **Client ID**.

You'll paste this Client ID into the app itself on first visit (Setup
screen) — it's stored in your browser's `localStorage`, not in the repo.

### 2. Enable GitHub Pages for this repo

One-time, in the repo's **Settings → Pages**: set **Build and
deployment → Source** to **GitHub Actions**. The included workflow
(`.github/workflows/deploy.yml`) then builds and deploys automatically on
every push to `main`.

### 3. Run it

Locally:

```
npm install
npm run dev
```

Open the printed `localhost` URL, paste your Google Client ID into the
Setup screen, sign in, and use it — either "Sync Google now", import an
`.ics` file, or add flights manually.

On GitHub Pages: once the Actions workflow has deployed, open
`https://<your-github-username>.github.io/flights-tracker/` and do the
same first-run setup there (it's a separate origin from localhost, so it
needs the Client ID pasted in again the first time you open it from that
URL).

## Using it with Google only (skip iCloud entirely)

iCloud is fully optional — if you never open the "Import iCloud calendar"
panel, nothing related to it runs. You can also skip Google Calendar sync
entirely and only use **"+ Add flight"** to enter flights by hand; Google
sign-in is still required either way, since it's both the auth and the
Sheet storage.

## Known limitations

- Flight detection is heuristic (regex/keywords over free text) — unusual
  confirmation email formats may be missed or misparsed; use "Add flight"
  manually as a fallback.
- The "miles flown" stat only counts routes between airports in the small
  curated coordinate list in `src/lib/airports.ts`; unlisted airports
  still count as a segment but not toward mileage.
- No refresh token for Google (see above) — expect to re-sign-in
  occasionally.
- iCloud import is manual/on-demand, not a live sync — you decide when to
  re-export and re-upload the `.ics` file.
- `npm audit` flags one moderate/high advisory in `esbuild`, nested inside
  Vite's dev server tooling (GHSA-67mh-4wv8-2f99). It only affects
  `npm run dev` (a malicious site could in theory read local dev-server
  responses while it's running) — it has no effect on the production
  static build served by GitHub Pages. The fix requires a Vite major
  version bump; not worth the churn for a personal project at this
  point.
