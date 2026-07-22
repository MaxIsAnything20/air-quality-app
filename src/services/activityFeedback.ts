import type { Activity } from '../types'
import { aqiLevelFromValue } from '../types'
import { aqiLevelLabel } from '../aqiColors'
import {
  activityAverageAqi,
  activityPeakAqi,
  activityDistanceMeters,
  activityDurationMs,
} from './activityLog'

/**
 * Rule-based (non-AI) post-activity feedback, in the same spirit as
 * conditionAlert.ts. Keeping this deterministic avoids adding a new API
 * cost for a feature that doesn't need generative text.
 */
export function buildActivityFeedback(activity: Activity): string {
  const avgAqi = activityAverageAqi(activity)
  const peakAqi = activityPeakAqi(activity)
  const distanceKm = activityDistanceMeters(activity) / 1000
  const durationMin = activityDurationMs(activity) / 60000

  const distancePart =
    distanceKm >= 0.1 ? `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km` : null
  const durationPart =
    durationMin >= 1 ? `${Math.round(durationMin)} min` : null

  const statsClause = [distancePart, durationPart].filter(Boolean).join(' over ')

  if (avgAqi == null) {
    return statsClause
      ? `Logged ${statsClause}. No air quality readings were available near your route, so we couldn't estimate exposure for this activity.`
      : "No air quality readings were available near your route, so we couldn't estimate exposure for this activity."
  }

  const avgLevel = aqiLevelFromValue(avgAqi)
  const avgLabel = aqiLevelLabel[avgLevel]
  const peakLevel = peakAqi != null ? aqiLevelFromValue(peakAqi) : avgLevel

  const opener = statsClause
    ? `You covered ${statsClause} while breathing air that averaged ${avgAqi} AQI (${avgLabel}).`
    : `Your air exposure for this activity averaged ${avgAqi} AQI (${avgLabel}).`

  let advice: string
  if (avgLevel === 'good') {
    advice = 'Conditions were clean for the whole activity — great time to be outside.'
  } else if (avgLevel === 'moderate') {
    advice = 'Air quality was acceptable, though sensitive groups may have noticed mild effects.'
  } else if (avgLevel === 'sensitive') {
    advice =
      'This is a level that can affect people with asthma or other respiratory conditions. Consider lighter effort or an indoor option next time conditions look similar.'
  } else if (avgLevel === 'unhealthy') {
    advice =
      'This level of exposure isn\'t great for sustained outdoor effort. Shorter, lower-intensity sessions — or moving indoors — are worth considering when air quality is this high.'
  } else {
    advice =
      'This was a high-exposure session. If you have any respiratory sensitivity, it\'s worth checking conditions before heading out again.'
  }

  const peakClause =
    peakAqi != null && peakLevel !== avgLevel
      ? ` At its worst, you passed through a ${peakAqi} AQI (${aqiLevelLabel[peakLevel]}) area.`
      : ''

  return `${opener}${peakClause} ${advice}`
}
