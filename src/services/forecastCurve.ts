import { aqiToScore } from '../types'

export interface HourPoint {
  hour: number
  aqi: number
  isNow: boolean
}

/**
 * A smooth curve anchored at two REAL numbers — a current AQI reading and
 * today's real forecast peak — rather than 24 invented hourly
 * measurements. AirNow's forecast is a single daily peak, not a timed
 * curve, so this deliberately never claims to know *when* the peak
 * happens: each hour's value just eases from the real "now" reading
 * toward the real peak the further that hour is from now, in either
 * direction, symmetric around "now" rather than picking an arbitrary
 * peak hour. Shared between the forecast screen's hourly/pollutant
 * charts and the home screen's "cleanest time" chip so both features
 * describe the exact same estimate rather than two different guesses.
 */
export function buildEstimatedHourlySeries(nowValue: number, peakValue: number, nowHour: number): HourPoint[] {
  const points: HourPoint[] = []
  for (let hour = 0; hour < 24; hour++) {
    const rawDist = Math.abs(hour - nowHour)
    const circularDist = Math.min(rawDist, 24 - rawDist)
    const t = circularDist / 12
    const aqi = nowValue + (peakValue - nowValue) * t
    points.push({ hour, aqi: Math.round(aqi), isNow: hour === nowHour })
  }
  return points
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

/** "Clean" cutoff for findCleanestWindow — matches the score >= 60
 * boundary already used by scoreLabel() for "Good" and above, so this
 * lines up with language already shown elsewhere in the app rather than
 * introducing a new, unexplained bar. */
const CLEAN_SCORE_THRESHOLD = 60

export interface CleanestWindow {
  startHour: number
  endHour: number
  allDay: boolean
}

/**
 * Finds the single longest contiguous stretch of hours (0-23, wrapping
 * through midnight if needed) whose estimated score is "Good" or
 * better. Returns null if no hour in the day clears that bar — an
 * honest "nothing to report" rather than forcing a window that doesn't
 * exist. Doesn't assume the clean stretch is centered on "now": it scans
 * for the actual longest run so an unusual curve (e.g. a peak that
 * already passed today) is still handled correctly.
 */
export function findCleanestWindow(series: HourPoint[]): CleanestWindow | null {
  const n = series.length
  if (n === 0) return null
  const clean = series.map((point) => aqiToScore(point.aqi) >= CLEAN_SCORE_THRESHOLD)

  if (clean.every(Boolean)) return { startHour: 0, endHour: n - 1, allDay: true }
  if (!clean.some(Boolean)) return null

  // Longest circular run of `true`: scan a doubled array and cap any
  // candidate run at length n so the whole array read twice can't be
  // mistaken for one 48-hour run.
  const doubled = clean.concat(clean)
  let bestStart = 0
  let bestLen = 0
  let curStart = 0
  let curLen = 0
  for (let i = 0; i < doubled.length; i++) {
    if (doubled[i]) {
      if (curLen === 0) curStart = i
      curLen++
      if (curLen > bestLen && curLen <= n) {
        bestLen = curLen
        bestStart = curStart
      }
    } else {
      curLen = 0
    }
  }

  const startHour = bestStart % n
  const endHour = (bestStart + bestLen - 1) % n
  return { startHour, endHour, allDay: false }
}

/** Formats a CleanestWindow into the home screen's "6 AM–7 PM" style
 * label, matching formatHourLabel's 12-hour convention. */
export function formatCleanestWindowLabel(window: CleanestWindow | null): string {
  if (!window) return 'No clean window today'
  if (window.allDay) return 'All day'
  if (window.startHour === window.endHour) return formatHourLabel(window.startHour)
  return `${formatHourLabel(window.startHour)}–${formatHourLabel(window.endHour)}`
}
