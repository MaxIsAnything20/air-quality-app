# AirTrack

A mobile-first air quality / wildfire smoke tracker. Map-first layout,
inspired by the "minimal, crisis-usable" pattern (see Watch Duty, Windy,
IQAir for reference), built around: current conditions, a monthly
cumulative-exposure view, threshold alerts, a saved health profile, and a
plain-language AI summary.

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- react-leaflet (OpenStreetMap tiles, no API key needed for the map itself)

## Run it

```bash
npm install
cp .env.example .env
# add your AirNow / PurpleAir / (optional) Gemini keys to .env — see below
npm run dev
```

Open the printed localhost URL. Resize your browser to phone width (or
open dev tools device mode) to see it as the mobile shell.

## Tests

```bash
npm test
```

Runs the Vitest suite (`vitest run`) over the app's pure-logic modules —
the divergence detector, the EPA guidance/recommendation table, alert
threshold and health profile persistence (including corrupt-`localStorage`
fallback paths), and the time-slider tense/label helpers. `npm run
test:watch` re-runs on change. Coverage is intentionally scoped to logic
that's easy to get subtly wrong and hard to eyeball-check (distance math,
threshold comparisons, tense/EPA-figure wording) rather than UI
components — there's no component or end-to-end test coverage yet.

## Getting an AirNow API key

1. Go to https://docs.airnowapi.org, click "Request an AirNow API Account"
2. Register with your email, then activate the account from the confirmation email
3. Your key is on the Web Services dashboard once logged in
4. Paste it into `.env` as `AIRNOW_API_KEY=your-key-here` (no `VITE_` prefix
   — see "Keys are server-side" below)

It's free, and requests are rate-limited per key (see AirNow's docs for
current limits) — plenty for local development.

If you don't set a key, or a request fails for any reason (rate limit,
no station near you, offline), the app falls back to sample data and
shows a small banner saying so — it never just breaks.

## Getting a PurpleAir API key

1. Go to https://develop.purpleair.com and sign in with a Google account
2. On the "keys" page, click the "+" button to create a key — leave it
   as Read, Enabled
3. Paste it into `.env` as `PURPLEAIR_API_KEY=your-key-here` (no `VITE_` prefix)

Also free. Same fallback behavior as AirNow: no key or a failed request
just shows sample sensor data with its own banner.

## Getting a Gemini API key (optional)

Only needed for the AI-generated plain-language summary on the map tab.

1. Go to https://aistudio.google.com/apikey and sign in with a Google account
2. Click "Create API key" — no billing account required
3. Paste it into `.env` as `GEMINI_API_KEY=your-key-here`

Free tier (as of when this was written): 1,500 requests/day on Gemini's
Flash models, no card needed, no expiration — plenty for one short summary
per page load. Just don't enable billing on the Google Cloud project tied
to the key, since that removes the free tier.

Without it, the summary card still shows a sentence — just one built
locally by a rule-based fallback instead of the model — and says so.

## Keys are server-side

`AIRNOW_API_KEY`, `PURPLEAIR_API_KEY`, and `GEMINI_API_KEY` are
deliberately **not** prefixed with `VITE_`. That prefix is what tells Vite
to inline a value into the client bundle — since these keys should never
ship in browser-visible JS, none of them use it.

- In dev, `vite.config.ts` runs a small middleware that reads these from
  `.env` and proxies `/api/airnow`, `/api/purpleair`, and `/api/summary`,
  attaching each key itself before forwarding upstream.
- In production, the same three routes are backed by the serverless
  functions in `api/` (`api/airnow.ts`, `api/purpleair.ts`, `api/summary.ts`,
  plus `api/smoke.ts` / `api/fire.ts` for the keyless NOAA feeds). Deploy
  this to Vercel (or adapt the handler signature for Netlify/Cloudflare
  Workers) and set the same three env vars in that provider's dashboard.
  The client code never changes between dev and prod — it only ever calls
  its own `/api/*` paths.

## What's real vs. mocked right now

- **Current AQI + forecast peak** — live, from the AirNow API
  (`src/services/airnow.ts`), based on your browser's geolocation
  (falls back to San Francisco if location is denied) or a searched
  location. Tapping any AQI dot on the map selects that station — the
  summary card below switches to describe it by name (AQI, pollutant, and
  a personalized recommendation) instead of a separate popup, since the
  two were showing overlapping information. Sample-data mode uses the
  same selection behavior with placeholder station names.
- **Smoke polygons (light/medium/heavy)** — live, from NOAA's HMS
  `smoke.kml` feed (`src/services/smoke.ts` + `src/services/smokeKml.ts`),
  proxied through `/api/smoke`. No API key needed. Falls back to sample
  polygons if the feed is unreachable, shown with its own small banner
  independent of the AirNow one.
- **Fire detection points** — live, from NOAA HMS `fire.kml`
  (`src/services/fire.ts` + `src/services/fireKml.ts`), same feed family
  as smoke. Filtered to within 300km of the current location, since the
  raw feed covers all of North America. Falls back to sample points with
  its own banner if unreachable. Titles are raw satellite detections
  (e.g. "Fire detected (Suomi NPP)"), not human-assigned fire names — the
  real feed doesn't provide those.
- **Place/ZIP search** — live, via OpenStreetMap's Nominatim
  (`src/services/geocode.ts`), no API key needed. Selecting a result
  re-centers the map and re-fetches AQI/fire data for that location.
- **PurpleAir sensor overlay** — live, via PurpleAir's API
  (`src/services/purpleair.ts`), proxied through `/api/purpleair` with the
  key attached server-side. Applies the EPA/AirFire smoke correction to
  PurpleAir's raw PM2.5 reading before converting to AQI, since the raw
  value runs high in smoke. Filtered to a ~25km box around the current
  location — tighter than the fire feed's 300km, since the point of this
  layer is hyperlocal density, not wide coverage.
- **Multi-source divergence detection** — real
  (`src/services/divergence.ts` + `src/components/DivergenceBanner.tsx`).
  Cross-checks nearby PurpleAir sensors against the nearest official
  AirNow station and flags sensors reading notably worse (either two full
  AQI categories worse, or a 50+ point AQI gap) — a signal that a
  fast-developing local event (a new fire, a drifting smoke plume) hasn't
  reached the hourly-updated official network yet. Deliberately
  one-directional: official readings coming in worse than PurpleAir isn't
  flagged, since that's usually just sensor noise or siting differences,
  not a real divergence. Skipped on sample data for the same reason the
  AI summary is.
- **Monthly exposure history** — real, logged client-side
  (`src/services/historyLog.ts`) each time a live AirNow reading comes in.
  AirNow's historical endpoint only returns one day/reporting-area per
  call, so instead of calling it repeatedly this keeps its own rolling log
  in `localStorage` as you use the app. On a brand-new device with no
  history yet, the History tab shows a fabricated sample curve instead
  (clearly labeled) until real days accumulate — there's no way to
  retroactively backfill days before the app was first opened.
- **AI-generated plain-language summary** — real, via Google's Gemini API
  through `/api/summary` (`src/services/summary.ts` +
  `src/hooks/useSummary.ts`). Takes current AQI, forecast peak, and
  whether your saved health profile has any conditions noted, and returns
  two grounded sentences: current conditions, plus a direct "OK to go
  outside" recommendation. Tap any AQI circle on the map to switch the
  card to that specific station instead of your overall location (own
  AQI/pollutant, no per-station forecast — AirNow doesn't publish one at
  that granularity, so the summary says so rather than reusing the
  regional forecast as if it applied). The category-level advice ("reduce
  prolonged exertion," "sensitive groups should stay indoors," etc.) is
  paraphrased from EPA/AirNow's actually-published Cautionary Statements
  and Activity Guides (`src/services/aqiGuidance.ts`), handed to the model
  as context rather than left for it to invent. The specific minute
  estimates shown alongside that advice (e.g. "roughly 30 minutes") are
  **not** official EPA figures — EPA's own guidance is qualitative, not
  tied to a clock time — so those are clearly labeled in the UI, the code,
  and the AI prompt as an illustrative rule of thumb, not medical advice.
  Skipped entirely (no wasted request) while the rest of the app is
  showing sample data. Falls back to a local, rule-based sentence if
  `GEMINI_API_KEY` isn't set or the request fails — same "never just
  breaks" pattern as everything else.
- **Full per-pollutant breakdown** — real, part of the same AirNow
  response already being fetched. AirNow reports one AQI per pollutant
  (PM2.5, ozone, etc.) for a station and treats the worst one as *the*
  AQI; this app used to discard the rest. Selecting a station now shows a
  small badge per pollutant it reports (`AqiReading.pollutants` in
  `types.ts`, built in `src/services/airnow.ts`'s
  `buildPollutantBreakdown`), and the AI summary is told about a
  secondary pollutant when one exists so it can mention it if it's
  notably elevated, instead of only ever naming whichever one is worst.
  Only shown when a station reports more than one pollutant — most
  stations report two (PM2.5 and ozone), some only one.
- **Time slider on the map** — real, in three parts: "today" (live, as
  above), past days (`src/services/mapSnapshotLog.ts` — a local snapshot
  taken once/day as you actually use the app, same "no fabricated
  backfill" honesty as the History tab), and "tomorrow" (AirNow's real
  regional forecast, AQI only). There's no reliable, documented per-date
  URL for NOAA's smoke/fire archive (their filename convention changed in
  2022, and what's public is a directory dump / interactive viewer, not a
  stable REST endpoint) — so past smoke/fire only exists for days this
  browser actually logged, and the forecast step only ever covers AQI.
  The map says so explicitly (not silently blank) when you're on a layer
  or day that has no data for the current step. Slider only appears once
  there's actually more than one step to show.
- **Alerts tab** — real, threshold-based notifications, in two modes.
  Foreground alerts (`src/components/AlertsView.tsx` +
  `src/hooks/useAlertNotifications.ts`) fire one browser Notification per
  calendar day if the live AQI reaches your threshold while the app is
  open in a tab. Background alerts are also real, not aspirational: a
  service worker (`public/sw.js`) + Web Push subscription
  (`src/services/pushSubscription.ts`) + Upstash Redis for subscription
  storage + a GitHub Actions cron job (`.github/workflows/push-check.yml`,
  every 15 minutes) hitting `/api/push/check` mean you can get a
  notification even with the app fully closed. See `PUSH_SETUP.md` for
  the setup/deploy details and required env vars.
- **Profile tab** — real, a saved health profile
  (`src/components/ProfileView.tsx` + `src/services/profile.ts`):
  asthma, heart/lung disease, age, pregnancy, outdoor work. Stored in
  `localStorage` only. Feeds the AI summary's personalization, and now
  also the Alerts tab: a first-time alert threshold defaults to Moderate
  (51+) instead of Unhealthy for Sensitive Groups (101+) if the profile
  has any condition checked, and the Alerts tab shows an inline
  suggestion (with a one-tap "Use 51+") if the profile is later edited
  to become sensitive while a looser threshold is already saved. It never
  silently overwrites an explicit choice — only suggests.

## Structure

```
src/
  components/
    MapView.tsx          map + layer toggle (smoke/fires/AQI/PurpleAir) + working zoom/recenter
    MapLegend.tsx         collapsible legend, per-layer swatches + explanation (no cross-tab bleed)
    SearchBar.tsx         live place/ZIP search (Nominatim), debounced
    ConditionBanner.tsx   single top-priority alert
    DivergenceBanner.tsx  official-vs-citizen-sensor disagreement banner
    StatStrip.tsx         current / monthly / forecast stat cards
    SummaryCard.tsx        AI (or fallback) plain-language summary
    HistoryView.tsx       month-to-date AQI chart + stats (real once logged, else sample)
    AlertsView.tsx         threshold + notification-permission UI, background alert toggle
    ProfileView.tsx         saved health profile UI
    BottomNav.tsx          map / history / alerts / profile tabs
    ThemeToggle.tsx        light/dark switch
  hooks/
    useAirQuality.ts       live AirNow + NOAA smoke/fire data, search override, sample-data fallback, history logging
    useSummary.ts           AI summary + local fallback, skips the API call on sample data
    useAlertNotifications.ts  fires one browser Notification/day above threshold
    useTheme.ts            theme state + persistence
  services/
    airnow.ts               AirNow API client (via /api/airnow)
    airnowTypes.ts           AirNow response types
    conditionAlert.ts        turns AQI + forecast into a plain-language alert
    divergence.ts             AirNow-vs-PurpleAir disagreement detector
    geolocation.ts           browser geolocation with fallback
    geocode.ts               Nominatim place/ZIP search
    purpleair.ts             PurpleAir sensor fetch (via /api/purpleair), EPA smoke correction
    smoke.ts / smokeKml.ts   NOAA HMS smoke feed (via /api/smoke)
    fire.ts / fireKml.ts     NOAA HMS fire feed (via /api/fire), radius-filtered
    historyLog.ts             real rolling daily-AQI log in localStorage
    mapSnapshotLog.ts          real per-day map snapshot log, backs the time slider's past days
    summary.ts                AI summary client (via /api/summary)
    alertSettings.ts          threshold + enabled state, persisted
    profile.ts                health profile + HEALTH_CONDITIONS, persisted
    pushSubscription.ts        client-side Web Push subscribe/unsubscribe helpers
    apiError.ts                shared "server key not configured" error type
  data/mockData.ts         sample data used as a fallback everywhere above
  types.ts                 shared app types + AQI level helper + PM2.5-to-AQI conversion
api/
  airnow.ts / purpleair.ts / summary.ts   serverless functions, keys attached server-side
  smoke.ts / fire.ts                       keyless NOAA proxies (CORS-avoidance only)
  push/subscribe.ts / unsubscribe.ts / check.ts   background push subscription + delivery
public/
  sw.js                     service worker — receives and shows background push notifications
```

## Known limitations worth knowing about

- **AirNow is retiring specific lat/long web service paths "in the fall of
  2026" — re-checked, and it's narrower than I first thought.** Re-fetched
  `docs.airnowapi.org/webservices` directly (not secondhand) and read the
  full page this time: the two exact paths this app calls
  (`/aq/observation/latLong/current/`, `/aq/forecast/latLong/` — now
  centralized as `CURRENT_OBSERVATIONS_PATH`/`FORECAST_PATH` at the top of
  `src/services/airnow.ts`) do appear to be in the "will be retired" list.
  But **lat/long querying itself isn't going away** — the same docs page
  separately lists still-current services ("Current Forecasts: By
  Reporting Area, Lat/Long, or Zip Code" and "Current Observations: By Zip
  Code or Lat/Long") that also take lat/long, which reads like several
  older single-purpose endpoints being consolidated into unified ones, not
  the capability being removed. The one real loss: AirNow's *historical*
  observation endpoint is being narrowed to state-level queries only — but
  this app never calls that endpoint (see below), so it's moot here.
  I could not get the exact replacement path from the public docs — AirNow
  builds exact query URLs through a "Generate URL" tool that needs a
  logged-in developer account, which this environment doesn't have. If
  you're reading this after fall 2026 and AirNow calls start failing,
  that's almost certainly why — log in yourself, find the current
  equivalent, and update the two path constants in `airnow.ts`; nothing
  else should need to change, since the per-pollutant response shape isn't
  expected to change. **In the meantime this isn't a silent-failure risk**:
  every fetch in `useAirQuality.ts` already catches any error (wrong key,
  rate limit, network blip, or a future 404) and falls back to sample data
  with a visible banner — so the worst case between now and a manual fix
  is losing live data, not a crash.
- **History only starts from first use.** The rolling log lives in this
  browser's `localStorage`; clearing site data or switching devices resets
  it to zero, and there's no server-side backfill. AirNow does have a real
  historical-observation endpoint (one day per call, matching what this
  app assumed), but per the note above it's losing lat/long granularity
  in the same fall-2026 change — not that it matters, since this app's
  history is self-logged rather than calling that endpoint at all.
- **Sample-data station/sensor names are deliberately generic** ("Sample
  Station A," "Sample Sensor B"), not real place names, and both AQI and
  PurpleAir sample readings get re-centered near the real/searched
  location (`shiftToCenter()` in `useAirQuality.ts`) rather than always
  sitting near San Francisco where the mock data is anchored. Worth
  remembering if you add more mock readings later — same pattern applies.
- **Background push notifications require their own setup and env vars.**
  The service worker + Web Push + Redis + cron pipeline described above is
  real and deployed, but only fires if `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`,
  `CRON_SECRET`, and the Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN`
  vars are all configured (see `PUSH_SETUP.md`) — without them the
  Alerts tab silently falls back to foreground-only notifications. The
  Alerts tab also still links out to AirNow's own EnviroFlash email/text
  alerts (`https://www.enviroflash.info/`) as a zero-setup alternative.
- **There's no automated test coverage for React components or
  end-to-end flows yet** — `npm test` (Vitest) covers the pure-logic
  modules (divergence detection, AQI guidance, alert/profile persistence,
  time-step formatting), not the UI layer.
- **The Gemini model in `api/summary.ts` / `vite.config.ts` uses the
  `gemini-flash-latest` alias**, not a version pinned to a specific
  release, specifically so it keeps working as Google rotates which exact
  model build is current — but re-verify at
  <https://ai.google.dev/gemini-api/docs/models> if you're reading this a
  while after this README was last touched, since Google periodically
  changes which models (and aliases) are on the free tier.
