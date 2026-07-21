// Stores a browser's push subscription + the location/threshold to check
// it against. KV_REST_API_URL / KV_REST_API_TOKEN are auto-injected once
// you provision a Redis store from the Vercel dashboard (Storage tab ->
// Marketplace Database Providers -> Upstash) — "Vercel KV" as a standalone
// product was sunset in late 2024 and folded into this Marketplace flow,
// but the env var names it injects (KV_REST_API_URL/TOKEN) stayed the
// same, which is what Redis.fromEnv() below reads.
import { Redis } from '@upstash/redis'

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body: Partial<SubscribeBody> =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const { subscription, lat, lng, thresholdAqi } = body

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
