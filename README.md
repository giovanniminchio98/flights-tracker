# flights-tracker

A personal, Flighty-style flight tracker that auto-detects flights from your
Google Calendar and iCloud Calendar (the events Gmail/Apple auto-create from
airline confirmation emails), dedupes them across both sources, and stores
the result in a Google Sheet — no external database, no flight-status API
keys.

## How it works

1. **Sync now** pulls events from every Google calendar and every iCloud
   calendar (via CalDAV) in a `-2y` to `+1y` window around today.
2. Each event's title/description/location is run through shared text
   heuristics (airline code + flight number, keywords like "boarding pass",
   "confirmation code", "PNR", etc.) to decide whether it's a flight and to
   extract `{ airline, flightNumber, confirmationCode, departureAirport,
   arrivalAirport, departureTime, arrivalTime }`.
3. Candidates are deduped:
   - **Secondary key** (`source:eventId`) — skip an event that's already
     been synced before.
   - **Primary key** (`flightNumber` + departure date) — the same
     real-world flight, regardless of which calendar it came from. A match
     merges into the existing Sheet row (filling blanks, refreshing times,
     unioning `linkedEventIds`/`sources`) instead of creating a duplicate.
4. Rows live in a Google Sheet named **Flight Tracker** (tab **Flights**),
   created automatically on first sync. Nothing is ever auto-deleted —
   deleting a flight is a manual action from the dashboard.

Non-goals: no live flight status/delays/gates, no third-party flight APIs,
no separate database, no multi-user support.

## Stack

Next.js 14 (App Router) + TypeScript, NextAuth for Google OAuth,
`googleapis` for Calendar/Sheets, `tsdav` + `node-ical` for iCloud CalDAV,
Tailwind for styling. Session storage is just the encrypted NextAuth JWT
cookie — no server-side session DB either.

## Setup

### 1. Google Cloud project

1. Create (or reuse) a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library**: enable **Google Calendar API** and
   **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   type **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
     (plus your production URL's equivalent, e.g.
     `https://your-app.vercel.app/api/auth/callback/google`).
4. Copy the generated **Client ID** and **Client secret**.
5. If your OAuth consent screen is in "Testing" mode, add your own Google
   account as a test user (this is a single-user app, no verification needed).

### 2. iCloud app-specific password

Apple has no OAuth API for third-party calendar access, so this uses CalDAV
with an app-specific password instead of your real Apple ID password:

1. Go to [appleid.apple.com](https://appleid.apple.com) → **Sign-In and
   Security → App-Specific Passwords** → generate one.
2. Note your Apple ID email and the generated password for the env vars below.

### 3. Environment variables

Copy `.env.example` to `.env` and fill in:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

ICLOUD_APPLE_ID=you@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Leave these two empty on first run — see below.
GOOGLE_SHEET_ID=
GOOGLE_REFRESH_TOKEN=
CRON_SECRET=
```

### 4. Run it

```
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with Google (grants
`calendar.readonly` and `spreadsheets` scopes only — no Gmail access), then
hit **Sync now**. The Flight Tracker spreadsheet is created automatically
on that first sync; check the terminal / `data/app-config.json` for its ID
and Sheets URL.

Go to **Settings** to confirm the iCloud CalDAV connection works (or to see
what's missing if it doesn't).

## Storage & config persistence

There's intentionally no database. Two small pieces of state have nowhere
else to live and are persisted to a local `data/app-config.json` (gitignored)
on any deploy target with a writable/persistent filesystem:

- `sheetId` — the auto-created spreadsheet's ID, so re-runs don't create a
  second sheet.
- `googleRefreshToken` — captured from your first interactive sign-in, used
  by the optional unattended cron sync (see below) which has no browser
  session to draw an access token from.

Both fall back to (and are overridden by) the `GOOGLE_SHEET_ID` /
`GOOGLE_REFRESH_TOKEN` env vars, which is what you need on a
serverless/ephemeral-filesystem host like Vercel: run one sync locally
first, copy the printed/log values into your host's env vars, and redeploy.

## Scheduled auto-sync (optional)

`GET /api/cron/sync?secret=<CRON_SECRET>` re-runs the same sync job used by
the "Sync now" button, without a browser session. Set `CRON_SECRET` and
`GOOGLE_REFRESH_TOKEN` (see above), then wire up a scheduler, e.g. Vercel
Cron via `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/sync?secret=YOUR_CRON_SECRET", "schedule": "0 6 * * *" }]
}
```

## Known limitations

- Flight detection is heuristic (regex/keywords over free text), same as
  the spec calls for — unusual confirmation email formats may be missed or
  misparsed; use "Add flight" manually as a fallback.
- The "miles flown" stat only counts routes between airports in the small
  curated coordinate list in `lib/airports.ts`; unlisted airports still
  count as a segment but not toward mileage.
- `npm audit` flags a few moderate/high transitive advisories (in
  `postcss`, nested under Next.js's own build tooling, and `uuid`, nested
  under `googleapis`'s HTTP client). Both are indirect dependencies of
  dependencies with no compatible non-breaking fix available at time of
  writing; forcing the breaking upgrades pulls in Next.js 16 and a
  node-ical major bump. Worth revisiting later.
