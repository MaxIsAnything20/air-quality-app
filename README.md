# Respira

Track the air you actually breathe — current conditions, a personal exposure score, cleaner-route planning with turn-by-turn navigation, indoor air estimates, and group/event air-quality tracking, all in one mobile-first web app.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- react-leaflet (OpenStreetMap tiles)
- Upstash Redis (via @upstash/redis) for groups/events/push subscriptions
- Vercel serverless functions (api/) as the backend, all on free tiers

## Run it

```
npm install
cp .env.example .env
# fill in the keys you want to test locally — see below
npm run dev
```

Resize your browser to phone width (or use dev tools device mode) to see it as the mobile shell.

## What the app does

- **Home** — a card-grid dashboard: current outdoor AQI, cleanest time of day, indoor air estimate, a personal exposure score, route planning, activity recording, groups/leaderboards, badges, AutoTrack, connections, and events.
- **Route planning** (`src/components/RoutePlanningView.tsx`, `src/hooks/useRoutePlanning.ts`) — compares multiple walk/cycle routes between two points, colors each route by AQI along the path, calls out the worst stretch, and flags when no route is possible between two points. Routing is proxied through `/api/routes` to OSRM's free public demo server (`router.project-osrm.org`) — no key, no signup, ever.
- **Turn-by-turn navigation** (`src/components/NavigationView.tsx`, `src/hooks/useTurnByTurnNavigation.ts`) — foreground voice-guided navigation along a planned route, using the browser's geolocation `watchPosition` and `SpeechSynthesisUtterance`. No background tracking (that needs a native shell).
- **Air quality forecast** (`src/components/AirQualityForecastView.tsx`) — an hourly AQI curve for today and the rest of the week, with a tappable per-pollutant breakdown chart.
- **Indoor air** (`src/components/IndoorAirView.tsx`) — a live indoor-air estimate model plus a history graph, with sensor setup routed through Settings.
- **Groups & Events** (`src/components/GroupsView.tsx`, `src/components/EventsView.tsx`) — real leaderboards and events backed by Upstash Redis (`api/groups.ts`, `api/events.ts`): create/join a group or event with a share code, check in, compare exposure scores.
- **Badges & streaks** (`src/services/streak.ts`) — tied to logged activity days and event check-ins.
- **My activities** (`src/components/MyActivitiesView.tsx`, `src/components/ActivityView.tsx`) — logged activities with a live/completed route trace colored by AQI, editable/deletable segments, an AI "AirCoach" per-activity insight, and Web Share API sharing.
- **Health profile & Settings** (`src/components/SettingsView.tsx` and its sub-views) — a drill-down settings list: Profile, AutoTrack, Sensors, Locations, App Connections, Notifications (alert thresholds + push permission), Communication, and Health profile (conditions that affect risk: asthma, heart/lung disease, age, pregnancy, outdoor work).
- **Push notifications** — real background push via `web-push` + VAPID keys, subscriptions stored in Redis (`api/push/subscribe.ts`, `api/push/unsubscribe.ts`), sent by `api/push/check.ts` on a schedule driven by a GitHub Actions cron (`.github/workflows/push-check.yml`, every 15 minutes) rather than a paid Vercel Cron plan.
- **AI-generated summaries** — a plain-language current-conditions summary and per-activity AirCoach insight, both via `api/summary.ts` calling Google's Gemini API free tier. Falls back to a local rule-based sentence if the key isn't set or the request fails — this part of the app never just breaks, even if the AI call does.
- **5-pollutant tracking** — AQI plus PM2.5, PM10, ozone, NO2, and SO2 via Open-Meteo's Air Quality API, not just the single worst pollutant AirNow reports.
- **PWA install** — installable manifest, works as a home-screen app.

## Environment variables

See `.env.example` for the full list with setup instructions. Summary:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `AIRNOW_API_KEY` | Yes | Live AQI observation + forecast (free, docs.airnowapi.org) |
| `PURPLEAIR_API_KEY` | Yes | Community sensor overlay (free "Read" key, develop.purpleair.com) |
| `GEMINI_API_KEY` | Optional | AI summary/AirCoach text (free tier, aistudio.google.com/apikey) — falls back to a local sentence if unset |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Yes (Groups/Events/push) | Auto-injected when you provision Upstash Redis from Vercel's Storage tab |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Yes (push) | Generate with `npx web-push generate-vapid-keys` — see `PUSH_SETUP.md` |
| `CRON_SECRET` | Yes (push) | Shared secret so `/api/push/check` only responds to the real GitHub Actions workflow |
| `VITE_VAPID_PUBLIC_KEY` | Yes (push) | Same value as `VAPID_PUBLIC_KEY` — this one is safe to ship to the browser |

All server-side keys are deliberately **not** prefixed with `VITE_`, so Vite never inlines them into the client bundle. In dev, `vite.config.ts` proxies the relevant `/api/*` paths with the key attached server-side; in production the same paths are backed by the serverless functions in `api/`.

## Structure

```
src/
  components/   screens and reusable UI (Home, Route planning, Navigation, Groups, Events,
                 Settings sub-views, Indoor air, Forecast, Activity/My activities, Paywall, etc.)
  hooks/         useRoutePlanning, useTurnByTurnNavigation, and other data hooks
  services/      API clients (airnow, purpleair, routes, geocode, summary, streak, historyLog,
                 profile, divergence, activityInsight, pushSubscription, etc.)
  data/          sample/fallback data used when a live source is unreachable
  types.ts       shared app types
api/
  airnow.ts, purpleair.ts, smoke.ts, fire.ts   proxies for AQI/smoke/fire data, keys attached server-side
  routes.ts                                     OSRM routing proxy
  summary.ts                                     Gemini AI summary/AirCoach proxy
  groups.ts, events.ts                          Redis-backed leaderboards and events
  push/subscribe.ts, push/unsubscribe.ts, push/check.ts   web-push subscription + delivery
.github/workflows/push-check.yml                cron trigger for api/push/check (GitHub Actions, free)
```

## Known limitations worth knowing about

- **PurpleAir sensor overlay is currently returning 402 (Payment Required) from PurpleAir's own API.** The proxy (`api/purpleair.ts`) and key are both correctly configured — PurpleAir itself is rejecting the specific request (their free "Read" key has a limited monthly data allowance and bills per point beyond it). The app falls back to sample sensor data rather than breaking. Worth checking your usage/plan at develop.purpleair.com if you want this restored.
- **The AI summary (`/api/summary`) is currently returning 502** on every call — `GEMINI_API_KEY` is set correctly, but the upstream Gemini request is failing for a reason not yet confirmed (the code now logs the real upstream status/body via `console.error` in Vercel's function logs to help diagnose this). The app falls back to the local rule-based summary in the meantime, so nothing user-facing breaks.
- **No native background tracking.** AutoTrack, live location, and turn-by-turn navigation only run while this tab is open/foregrounded — there's no background service, since that requires a native app shell (React Native/Expo), which is out of scope for this web build.
- **Routing runs on OSRM's shared public demo server**, not a dedicated instance — it's free and keyless by design, but isn't meant for heavy production traffic and has no uptime guarantee.
- **No real payment processing.** The Paywall screen is UI only (a subscription preview carousel) — there's no billing integration, by design, since this project only uses free services.
- **No real payment processing.** The Paywall screen is UI only (a subscription preview carousel) — there's no billing integration, by design, since this project only uses free services.
