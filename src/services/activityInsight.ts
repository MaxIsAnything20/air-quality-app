import type { Activity } from '../types'
import { aqiLevelFromValue } from '../types'
import { ACTIVITY_TYPE_LABELS } from '../types'
import { activityAverageAqi, activityPeakAqi, activityDistanceMeters, activityDurationMs } from './activityLog'

/**
 * AirCoach-style, AI-generated per-activity insight — reuses the same
 * Gemini-backed /api/summary endpoint used for the general conditions
 * summary (src/services/summary.ts), just with mode: 'activity' and this
 * activity's own stats instead of live ambient AQI. Reusing the endpoint
 * (rather than adding a new serverless function) keeps Respira under
 * Vercel Hobby's per-deployment function cap.
 *
 * Throws on any failure — callers should catch and fall back to the
 * deterministic services/activityFeedback.ts sentence, which is always
 * shown regardless of whether this succeeds. Same "never just breaks"
 * pattern as the rest of the app's AI features.
 */
export async function fetchActivityInsight(activity: Activity): Promise<string> {
  const avgAqi = activityAverageAqi(activity)
  const peakAqi = activityPeakAqi(activity)
  const distanceKm = activityDistanceMeters(activity) / 1000
  const durationMinutes = activityDurationMs(activity) / 60000

  const res = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'activity',
      activityType: ACTIVITY_TYPE_LABELS[activity.type],
      avgAqi,
      avgLevel: avgAqi != null ? aqiLevelFromValue(avgAqi) : null,
      peakAqi,
      distanceKm,
      durationMinutes
    })
  })

  if (!res.ok) {
    throw new Error(`Activity insight request failed: ${res.status}`)
  }

  const data = await res.json()
  if (typeof data?.summary !== 'string' || !data.summary.trim()) {
    throw new Error('Activity insight response had no text content.')
  }
  return data.summary.trim()
}
