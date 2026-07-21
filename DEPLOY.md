# Deploying AirTrack to Vercel

## 0. Before you do anything else

This file, along with `vercel.json`, `.gitignore`, the `ErrorBoundary`
component, and a handful of `api/`/`src/services` fixes, did not exist on
GitHub as of this writing — only the core app (`src/`, `api/`) was pushed.
This document (and the sibling files it references) were generated to
close that gap. See `APPLY_INSTRUCTIONS.md` for exactly what to copy where
and which git commands to run before you deploy.

**Two real bugs were found and fixed as part of this pass** — not just
missing docs:

1. `src/services/smoke.ts` and `src/services/fire.ts` had
   `const BASE_URL = import.meta.env.DEV ? '/api/smoke' : 'https://www.ospo.noaa.gov'`.
   In production this made the browser call NOAA directly, bypassing the
   `api/smoke`/`api/fire` proxy that exists specifically to avoid NOAA's
   CORS policy — so the smoke and fire layers would silently fall back to
   sample data on every real deploy, no error visible anywhere except a
   failed fetch in devtools. Fixed to always use the same-origin path.
2. `api/airnow.ts`, `api/purpleair.ts`, `api/smoke.ts`, `api/fire.ts` are
   called by the client at **sub-paths** (e.g.
   `/api/airnow/aq/observation/latLong/current/?...`,
   `/api/purpleair/v1/sensors?...`). In dev, Vite's middleware
   (`server.middlewares.use('/api/airnow', ...)`) strips that prefix and
   matches any sub-path automatically. Vercel's file-system routing does
   not: a plain `api/airnow.ts` only matches the exact path `/api/airnow`,
   so every real request 404s. Fixed by renaming each to Vercel's
   catch-all convention (`api/airnow/[...path].ts`, etc.) and stripping
   the prefix from `req.url` inside the handler, since Vercel — unlike the
   dev middleware — does not strip it for you.

Both bugs manifest the exact same way: the feature quietly shows its
"using sample data" banner in production while looking completely normal
in `npm run dev`. That's *why* they're worth knowing about even though the
app never crashes — the "never just breaks" fallback pattern that makes
this app resilient also makes routing bugs like these easy to miss without
specifically checking for live data.

## 1. Add environment variables in the Vercel dashboard

Go to your project on vercel.com → **Settings → Environment Variables**.
Add all three, exactly as named, **no `VITE_` prefix**:

| Name | Value | Notes |
|---|---|---|
| `AIRNOW_API_KEY` | your AirNow key | required for live AQI/forecast |
| `PURPLEAIR_API_KEY` | your PurpleAir key | required for the sensor layer |
| `ANTHROPIC_API_KEY` | your Anthropic key | optional — AI summary falls back to rule-based text without it |

For each one, check **Production**, **Preview**, and **Development**
(unless you deliberately want different keys per environment — most people
don't for a project this size). Save each variable.

A `VITE_`-prefixed name would get inlined into the client bundle at build
time, which is exactly what this app's server-side proxy pattern exists to
avoid — double check the names have no `VITE_` prefix before saving.

## 2. Apply the code fixes and push

See `APPLY_INSTRUCTIONS.md`. Short version: copy the changed/added files
into your real local repo, `git add -A`, commit, `git push`. Vercel will
auto-deploy a preview from that push if your project is Git-connected; the
production deploy in the next step picks up whatever's in your working
directory regardless.

## 3. Redeploy to production

From your local project directory, with the same account you used for
`vercel login`:

```bash
vercel --prod
```

This uploads your local working directory (including the changes from
step 2) and builds/deploys it to your production URL. Watch the CLI
output — it prints a build log inline and fails loudly on a build error
(e.g. a TypeScript error from `tsc -b` in `npm run build`).

## 4. Test checklist against the live URL

Open the production URL the CLI printed (or find it under the project's
**Deployments** tab, marked "Production"). Check each of these in order:

1. **Real AQI showing, not the sample-data banner.** The banner reads
   "Showing sample data — set AIRNOW_API_KEY on the server..." — if you
   set the key and still see it, see the "reading function logs" section
   below.
2. **Tap a station on the map.** The summary card should switch to
   describe that specific station (name, AQI, pollutant breakdown if it
   reports more than one pollutant).
3. **PurpleAir layer.** Toggle it on in the map's layer control — you
   should see sensor dots, not the "Showing sample PurpleAir data" banner.
4. **Alerts permission.** Go to the Alerts tab, pick a threshold, grant
   the browser notification permission when prompted. (You won't see an
   actual notification unless the live AQI is at/above your threshold —
   that's expected, not a bug.)
5. **Profile persistence.** Fill out the Profile tab, reload the page,
   confirm it's still there (this is `localStorage`, so it should survive
   a reload but not a different browser/device).
6. **History tab.** On a first visit this will show the labeled sample
   curve (expected — there's no history yet). It starts logging real days
   as you use the app; there's no way to backfill past days retroactively.

If **all six pass**, the deploy is confirmed working end-to-end.

## 5. Reading function logs when something looks wrong

If a banner shows sample data when it shouldn't (most likely candidate:
AirNow or PurpleAir key typo'd, or a fix from this pass didn't get
deployed):

1. vercel.com → your project → **Deployments** → click the latest
   (top) deployment → **Functions** tab.
2. You'll see one row per serverless function that received traffic —
   `api/airnow`, `api/purpleair`, `api/summary`, `api/smoke`, `api/fire`.
   Click the one behaving oddly.
3. Look for recent invocations. A `501` status means the function ran
   but didn't find its env var (`AIRNOW_API_KEY` etc. missing or
   misspelled in Settings → Environment Variables — re-check step 1,
   including that you redeployed *after* adding it: env vars only apply
   to deployments created after they're saved, not retroactively). A
   `404` on a request path containing `/api/airnow/aq/...` means the
   catch-all rename from this pass didn't make it into the deploy — check
   `APPLY_INSTRUCTIONS.md` again. A `502` means the function ran and
   reached out, but the upstream (AirNow/PurpleAir/NOAA/Anthropic) call
   itself failed — check the logged error text for which one and why
   (rate limit, network, bad key format).

## What commonly differs between local dev and a real Vercel deploy

- **Sub-path routing.** Covered above — the single biggest gotcha here,
  and the reason two of this app's five features were silently broken in
  every prior real deploy. Vite's dev middleware forgives loose routing
  in a way Vercel's file-system router does not.
- **Cold starts.** A serverless function that hasn't been called recently
  spins up fresh — expect the *first* request after a period of no
  traffic to take noticeably longer (roughly half a second to a couple of
  seconds) than the same request 30 seconds later. This can look like a
  slow initial load that then "healthy"s itself; it's not a bug.
- **Function timeouts.** Vercel's Hobby plan defaults functions to a 10
  second execution limit. All five functions here just proxy a single
  upstream fetch, so they should comfortably finish well under that in
  normal conditions — but a slow Anthropic response or a hung upstream
  connection could hit the ceiling and return a `504`. If `/api/summary`
  starts timing out specifically (others working fine), that's the first
  thing to suspect; the client already falls back to the local rule-based
  summary on any failure, so this degrades gracefully rather than
  breaking the UI.
- **Request-object shape.** Vercel's Node.js functions hand you a real
  Node `http.IncomingMessage`/`ServerResponse` pair (`req`/`res`), same
  as the dev middleware — but *without* any of connect/Express's
  convenience behavior like auto-stripped mount prefixes (see the
  sub-path bug above) or (depending on runtime/version) guaranteed
  `req.body` parsing for every content type. `api/summary.ts` already
  defends against this with
  `typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}`
  — worth keeping that pattern if you add another POST endpoint later.
- **Environment variable timing.** Adding or changing an env var in the
  Vercel dashboard does not affect deployments that already exist — only
  ones created afterward. If you just added a key, you need step 3
  (`vercel --prod`) to actually pick it up.
