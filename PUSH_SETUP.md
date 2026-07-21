# Setting up real background push notifications

This adds a second alert path alongside the existing foreground-only
browser Notification flow (`hooks/useAlertNotifications.ts`, unchanged).
Background alerts fire even with no tab open, via: a service worker +
Web Push on the client, Redis (Upstash, via Vercel's Marketplace) to store
subscriptions, and a GitHub Actions cron workflow polling `/api/push/check`
every 15 minutes (not Vercel's own Cron — see the note below on why).

Apply the files from this folder first (see the file list at the bottom),
then work through these steps in order. Every step here happens in your
accounts (GitHub, Vercel, Upstash) — I can't do any of it for you, but I
can walk you through it live if you want me to drive your screen for the
account-specific clicking.

## 1. Provision Redis

Vercel dashboard → your project → **Storage** tab → **Create Database** →
choose **Upstash** (this is what "Vercel KV" became after being sunset in
late 2024 — same result, different name in the UI). Follow the prompts;
Vercel will auto-inject `KV_REST_API_URL` and `KV_REST_API_TOKEN` into
your project's environment variables. No manual copy-paste needed for
those two.

## 2. Generate VAPID keys

From your local project directory:

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key. In Vercel → Settings → Environment
Variables, add:

- `VAPID_PUBLIC_KEY` = the public key
- `VAPID_PRIVATE_KEY` = the private key
- `VITE_VAPID_PUBLIC_KEY` = **the same public key, again** — the client
  needs it too, hence the `VITE_` copy (see
  `src/services/pushSubscription.ts`'s header comment for why this is the
  one value in the app that's safe to expose client-side)
- `VAPID_SUBJECT` = `mailto:` plus an email address you control (required
  by the Web Push spec, not secret)

Check Production + Preview + Development for all four, same as the other
env vars.

## 3. Generate a cron secret

Anything random works:

```bash
openssl rand -hex 32
```

Add it to Vercel as `CRON_SECRET` (Production + Preview + Development).

## 4. Wire up the GitHub Actions workflow

`.github/workflows/push-check.yml` is already in this bundle — it hits
`/api/push/check` every 15 minutes with the secret as a bearer token.
It needs two things set in your GitHub repo (**Settings → Secrets and
variables → Actions**):

- A **repository variable** named `AIRTRACK_URL` = your production URL
  (e.g. `https://air-quality-app.vercel.app`) — not secret, so it's a
  variable, not a secret
- A **repository secret** named `CRON_SECRET` = the exact same value you
  put in Vercel in step 3

Once both are set and the workflow file is pushed, it starts running on
its own schedule. You can trigger a manual test run any time from the
repo's **Actions** tab → "Push alert check" → **Run workflow**.

**Why GitHub Actions instead of Vercel's own Cron:** Vercel Hobby-plan
cron jobs are capped at once per day — too slow to be a useful air quality
alert. GitHub Actions' free tier can run every 15 minutes with no plan
upgrade. Trade-off: GitHub's scheduler is best-effort (expect some
jitter), and **scheduled workflows pause automatically after ~60 days of
no repository activity** — any commit or push resets that clock, so this
is unlikely to bite you while actively developing, but worth knowing if
the repo goes quiet for a couple of months.

## 5. Install the new dependencies

The `package.json` in this bundle lists `@upstash/redis` and `web-push`,
but run this yourself instead of trusting my pinned version numbers —
I can't verify what's actually latest on npm from here two years out:

```bash
npm install @upstash/redis web-push
```

If TypeScript complains about missing types for `web-push` after that,
run `npm install -D @types/web-push` too.

## 6. Deploy and test

```bash
git add -A
git commit -m "Add background push notifications (service worker, Redis-backed subscriptions, GitHub Actions cron)"
git push
vercel --prod
```

Then:

1. Open the live app → Alerts tab → toggle **Background alerts (app
   closed)** on. Your browser will prompt for notification permission if
   it hasn't already.
2. Vercel → Deployments → latest → Functions → `api/push/subscribe` —
   confirm a `200` response logged.
3. Close the tab entirely.
4. From GitHub → Actions → "Push alert check" → **Run workflow** (manual
   trigger, don't wait 15 minutes for the first test).
5. Check the workflow's log output — `{ "checked": 1, "notified": 0, "pruned": 0 }`
   (or `"notified": 1"` if your current AQI is at/above your threshold)
   means it's working end to end. `"checked": 0"` means the subscribe step
   didn't actually save — check `api/push/subscribe`'s function logs.

## Files in this bundle

New:
- `public/sw.js`
- `src/services/pushSubscription.ts`
- `api/push/subscribe.ts`
- `api/push/unsubscribe.ts`
- `api/push/check.ts`
- `.github/workflows/push-check.yml`

Replaced (full copies):
- `src/components/AlertsView.tsx` — adds the "Background alerts" toggle
- `.env.example` — documents the new vars
- `package.json` — adds `@upstash/redis` and `web-push` (see step 5 —
  reinstall rather than trust these version numbers)

One small manual edit needed — `src/App.tsx` doesn't need a full
replacement for this batch, just pass one more prop where `AlertsView` is
rendered:

```tsx
<AlertsView
  settings={alertSettings}
  onChange={handleAlertSettingsChange}
  sensitiveProfile={isSensitiveGroup(healthProfile)}
  center={air.center}
/>
```
