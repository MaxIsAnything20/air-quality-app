// Stores a browser's push subscription + the location/threshold to check
// it against, and (via action: 'notifyNow') sends an immediate one-off
// push to an already-registered subscription — used for the post-activity
// summary notification (src/services/pushSubscription.ts's
// sendActivitySummaryPush()). Kept in this same file rather than a new
// serverless function, since Vercel's Hobby plan caps functions per
// deployment (see api/events.ts's comment / task #118) and this reuses
// the exact same VAPID/web-push setup api/push/check.ts already has.
//
// KV_REST_API_URL / KV_REST_API_TOKEN are auto-injected once you
// provision a Redis store from the Vercel dashboard (Storage tab ->
// Marketplace Database Providers -> Upstash) — "Vercel KV" as a standalone
// product was sunset in late 2024 and folded into this Marketplace flow,
// but the env var names it injects (KV_REST_API_URL/TOKEN) stayed the
// same, which is what Redis.fromEnv() below reads.
import { Redis } from '@upstash/redis'
import webpush from 'web-push'

const redis = Redis.fromEnv()

interface SubscribeBody {
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  lat: number
  lng: number
  thresholdAqi: number
}

interface NotifyNowBody {
  action: 'notifyNow'
  endpoint: string
  title: string
  body: string
}

interface StoredSubscription {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  lat: number
  lng: number
  thresholdAqi: number
  lastNotifiedDate: string | null
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body: Partial<SubscribeBody & NotifyNowBody> =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}

  if (body.action === 'notifyNow') {
    const { endpoint, title, body: message } = body

    if (!endpoint || !title || !message) {
      res.status(400).json({ error: 'Expected { action: "notifyNow", endpoint, title, body }.' })
      return
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublicKey || !vapidPrivateKey) {
      res.status(501).json({ error: 'VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set on the server.' })
      return
    }

    const key = `push:sub:${endpoint}`
    const record = (await redis.get(key)) as StoredSubscription | null
    if (!record) {
      // Not an error from the client's point of view — it just means
      // background alerts were never enabled on this device, so there's
      // nothing to send to. src/services/pushSubscription.ts's
      // sendActivitySummaryPush() treats any non-200 here as a no-op.
      res.status(404).json({ error: 'No push subscription found for this device.' })
      return
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      vapidPublicKey,
      vapidPrivateKey
    )

    try {
      await webpush.sendNotification(
        record.subscription as any,
        JSON.stringify({ title, body: message, url: '/' })
      )
      res.status(200).json({ ok: true })
    } catch (err: any) {
      // 404/410 means the browser subscription is gone — clean it up
      // instead of leaving a dead entry for api/push/check.ts to keep
      // retrying forever.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await redis.del(key)
        await redis.srem('push:subs', key)
      }
      res.status(502).json({ error: 'Failed to send push notification.' })
    }
    return
  }

  const { subscription, lat, lng, thresholdAqi } = body as Partial<SubscribeBody>

  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    typeof thresholdAqi !== 'number'
  ) {
    res.status(400).json({ error: 'Expected { subscription: { endpoint, keys }, lat, lng, thresholdAqi }.' })
    return
  }

  // Keyed by endpoint (unique per browser subscription) — re-subscribing
  // (e.g. after changing the alert threshold) overwrites the existing
  // record instead of creating a duplicate.
  const key = `push:sub:${subscription.endpoint}`
  await redis.set(key, { subscription, lat, lng, thresholdAqi, lastNotifiedDate: null })
  // Upstash's REST API has no "list keys by pattern" call in typical
  // free-tier usage, so this set is a manual index api/push/check.ts
  // enumerates to find every subscription.
  await redis.sadd('push:subs', key)

  res.status(200).json({ ok: true })
}
