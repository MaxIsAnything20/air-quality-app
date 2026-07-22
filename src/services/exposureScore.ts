import type { Activity, DailyExposure } from '../types'
import { activityAverageAqi, activityDurationMs } from './activityLog'

export interface ExposureScoreResult {
  /** 0-100, higher = cleaner air breathed recently. */
  score: number
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very poor'
  detail: string
  daysConsidered: number
  activitiesConsidered: number
}

/**
 * A personal, deterministic (non-AI, no API cost) exposure score — a
 * single number summarizing how clean the air the user actually breathed
 * has been recently, distinct from the live AQI (which is just "right
 * now, at one station").
 *
 * Two kinds of exposure feed it, weighted differently:
 *  - Ambient days: each logged day's peak AQI counts once. This is
 *    "what the air was like," regardless of how much time was spent in it.
 *  - Tracked activities: each completed activity's average AQI is
 *    weighted by its duration, and roughly doubled — exercising increases
 *    breathing rate and depth, so the same AQI during a 45-minute run
 *    means meaningfully more actually inhaled than the same AQI on an
 *    ordinary day. This is a named, simplifying assumption, not a
 *    physiological model.
 *
 * Returns null when there's nothing to base a score on yet (new device,
 * no live AQI source connected, no activities tracked).
 */
export function computeExposureScore(
  recentDailyHistory: DailyExposure[],
  recentActivities: Activity[],
  sensitiveGroup: boolean
): ExposureScoreResult | null {
  const ambientPoints = recentDailyHistory.map((d) => ({ aqi: d.aqi, weight: 1 }))

  const activityPoints = recentActivities
    .filter((a) => a.status === 'completed')
    .map((a) => {
      const avgAqi = activityAverageAqi(a)
      if (avgAqi == null) return null
      const minutes = Math.max(5, activityDurationMs(a) / 60000)
      return { aqi: avgAqi, weight: (minutes / 60) * 2 }
    })
    .filter((p): p is { aqi: number; weight: number } => p != null)

  const allPoints = [...ambientPoints, ...activityPoints]
  if (allPoints.length === 0) return null

  const totalWeight = allPoints.reduce((sum, p) => sum + p.weight, 0)
  const weightedAqi = allPoints.reduce((sum, p) => sum + p.aqi * p.weight, 0) / totalWeight

  // Sensitive-group users feel effects at lower AQI thresholds than the
  // general population — that's the entire premise of EPA's "Unhealthy
  // for Sensitive Groups" band. Reflected here as a modest personal-risk
  // adjustment to the score; it doesn't change the underlying AQI shown
  // anywhere else in the app.
  const adjustedAqi = sensitiveGroup ? weightedAqi * 1.15 : weightedAqi

  // 0 AQI -> 100, 200 AQI -> 0, linear in between and clamped — simple by
  // design, not a claim of clinical precision.
  const score = Math.round(Math.max(0, Math.min(100, 100 - adjustedAqi / 2)))

  let label: ExposureScoreResult['label']
  let detail: string
  if (score >= 80) {
    label = 'Excellent'
    detail = "You've been breathing clean air recently."
  } else if (score >= 60) {
    label = 'Good'
    detail = 'Your recent air exposure has been mild.'
  } else if (score >= 40) {
    label = 'Fair'
    detail = 'Your recent exposure has been moderate — worth keeping an eye on.'
  } else if (score >= 20) {
    label = 'Poor'
    detail = 'Your recent exposure has been on the high side.'
  } else {
    label = 'Very poor'
    detail = 'Your recent exposure has been consistently high.'
  }

  return {
    score,
    label,
    detail,
    daysConsidered: recentDailyHistory.length,
    activitiesConsidered: activityPoints.length,
  }
}
