// The actual "send a notification while nobody has a tab open" step.
// Not triggered by Vercel Cron — Hobby-plan cron jobs are capped at once
// per day, too slow to be a useful air quality alert. Instead this is a
// plain HTTP endpoint hit on a schedule by a GitHub Actions workflow (see
// .github/workflows/push-check.yml), authenticated with CRON_SECRET the
// same way Vercel's own cron would, just supplied manually in the
// workflow's curl call instead of injected automatically.
//
// AQI lookup logic here is intentionally re-implemented rather than
// imported from src/services/airnow.ts — same "duplicated, not imported"
// reasoning as api/summary.ts's copy of AQI_GUIDANCE: this file is bundled
// standalone as a serverless function with its own dependencies
// (web-push, @upstash/redis) that have nothing to do with the client
// bundle.
import webpush from 'web-push'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const CURRENT_OBSERVATIONS_PATH = '/aq/observation/latLong/current/'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchWorstAqi(lat: number, lng: number, apiKey: string): Promise<number | null> {
  const params = new URLSearchParams({
    format: 'application/json',
    latitude: String(lat),
    longitude: String(lng),
    distance: '25',
    API_KEY: apiKey
  })
  const res = await fetch(`https://www.airnowapi.org${CURRENT_OBSERVATIONS_PATH}?${params}`)
  if (!res.ok) return null
  const observations: { AQI: number }[] = await res.json()
  if (!observations.length) return null
  return observations.reduce((worst, o) => (o.AQI > worst ? o.AQI : worst), 0)
}

// Standard EPA AQI category breakpoints — kept in sync by hand with
// src/services/aqiGuidance.ts's AqiLevel keys (same "duplicated, not
// imported" reasoning as the rest of this standalone serverless bundle).
type AqiLevel = 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'veryunhealthy' | 'hazardous'

function levelForAqi(aqi: number): AqiLevel {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'sensitive'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'veryunhealthy'
  return 'hazardous'
}

const LEVEL_LABEL: Record<AqiLevel, string> = {
  good: 'Good',
  moderate: 'Moderate',
  sensitive: 'Unhealthy for Sensitive Groups',
  unhealthy: 'Unhealthy',
  veryunhealthy: 'Very Unhealthy',
  hazardous: 'Hazardous'
}

// Same general-public guidance as src/services/aqiGuidance.ts's
// AQI_GUIDANCE.generalAdvice, condensed for a short push notification body
// (this endpoint has no per-subscriber sensitive-group flag to key off
// of, so it always uses the general-public line, not the sensitive one).
const GENERAL_ADVICE: Record<AqiLevel, string> = {
  good: 'a good day for any outdoor activity.',
  moderate: 'acceptable for most people and most outdoor activity.',
  sensitive: 'most people are fine, but sensitive groups should reduce prolonged exertion.',
  unhealthy: 'everyone should reduce prolonged or heavy outdoor exertion.',
  veryunhealthy: 'everyone should avoid prolonged or heavy outdoor exertion.',
  hazardous: 'everyone should avoid all outdoor physical activity.'
}

interface SubscriptionRecord {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  lat: number
  lng: number
  thresholdAqi: number
  lastNotifiedDate: string | null
}

export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const airnowKey = process.env.AIRNOW_API_KEY
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!airnowKey || !vapidPublicKey || !vapidPrivateKey) {
    res.status(501).json({
      error: 'AIRNOW_API_KEY, VAPID_PUBLIC_KEY, or VAPID_PRIVATE_KEY is not set on the server.'
    })
    return
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  )

  const keys: string[] = (await redis.smembers('push:subs')) ?? []
  const today = todayKey()
  let checked = 0
  let notified = 0
  let pruned = 0

  for (const key of keys) {
    const record = (await redis.get(key)) as SubscriptionRecord | null
    if (!record) {
      await redis.srem('push:subs', key)
      pruned++
      continue
    }

    checked++
    const aqi = await fetchWorstAqi(record.lat, record.lng, airnowKey)
    if (aqi === null || aqi < record.thresholdAqi) continue
    if (record.lastNotifiedDate === today) continue

    const level = levelForAqi(aqi)

    try {
      await webpush.sendNotification(
        record.subscription as any,
        JSON.stringify({
          title: `Air quality alert — ${LEVEL_LABEL[level]}`,
          body: `Current AQI is ${aqi} (${LEVEL_LABEL[level]}), at or above your ${record.thresholdAqi} threshold — ${GENERAL_ADVICE[level]}`,
          url: '/'
        })
      )
      await redis.set(key, { ...record, lastNotifiedDate: today })
      notified++
    } catch (err: any) {
      // 404/410 means the browser subscription is gone (uninstalled,
      // cleared site data, etc) — clean it up instead of retrying it
      // forever on every future run.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await redis.del(key)
        await redis.srem('push:subs', key)
        pruned++
      }
    }
  }

  res.status(200).json({ checked, notified, pruned })
}
