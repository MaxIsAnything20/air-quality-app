// Logs indoor air estimate snapshots over time so IndoorAirView can show
// a Day/Week/Month history graph instead of only a live current number.
// The indoor estimate itself (see IndoorAirView.tsx) is *computed*, not
// measured — derived from the live outdoor AQI plus the windows/purifier
// toggles — so "logging" here means recording a snapshot of that computed
// estimate whenever a fresh one becomes available, throttled so opening
// the screen repeatedly in a short span doesn't flood storage with
// near-duplicate points.
//
// Same trade-off as historyLog.ts's daily log: history only starts
// accumulating from whenever a given browser/device first opens this
// screen — there's no way to retroactively fill in time before that.
import { aqiToScore } from '../types'

const STORAGE_KEY = 'respira.indoorEstimates.v1'
// One point roughly every 15 min at most — plenty of resolution for the
// Day tab's hourly buckets without logging on every render.
const MIN_INTERVAL_MS = 15 * 60 * 1000
// A bit more than a month of 15-min points, so the Month tab never runs
// out of headroom before old points age out via the day cutoff below.
const MAX_DAYS_KEPT = 35
const MAX_POINTS_KEPT = 4000

interface StoredPoint {
  /** epoch ms */
  t: number
  aqi: number
}

function loadAll(): StoredPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Corrupt JSON or localStorage unavailable — treat as no history yet
    // rather than throwing, since logging is a nice-to-have, not critical.
    return []
  }
}

function saveAll(points: StoredPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points))
  } catch {
    // Quota exceeded, private browsing, etc — best-effort only.
  }
}

function dateKeyFor(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Records one indoor-estimate snapshot, skipping it if the most recent
 * logged point is still within MIN_INTERVAL_MS. Call this from
 * IndoorAirView whenever a fresh estimate is computed (mount, or when
 * outdoor AQI/windows/purifier change) — not on every render. */
export function recordIndoorEstimate(estimatedAqi: number): void {
  if (!Number.isFinite(estimatedAqi)) return
  const points = loadAll()
  const last = points[points.length - 1]
  const now = Date.now()
  if (last && now - last.t < MIN_INTERVAL_MS) return

  points.push({ t: now, aqi: Math.round(estimatedAqi) })
  const cutoff = now - MAX_DAYS_KEPT * 24 * 60 * 60 * 1000
  const trimmed = points.filter((p) => p.t >= cutoff).slice(-MAX_POINTS_KEPT)
  saveAll(trimmed)
}

export interface IndoorHourSlot {
  hour: number
  aqi: number | null
  score: number | null
}

/** Today's 24 hours as fixed slots (midnight to now), filled with the
 * average logged estimate for whichever points fall in that hour — an
 * hour with no logged points is null, not fabricated, matching
 * HistoryView's "gaps are real gaps" convention for its monthly chart. */
export function getTodayHourlySlots(): IndoorHourSlot[] {
  const points = loadAll()
  const now = new Date()
  const todayKey = dateKeyFor(now.getTime())
  const currentHour = now.getHours()

  const byHour = new Map<number, number[]>()
  for (const p of points) {
    const d = new Date(p.t)
    if (dateKeyFor(p.t) !== todayKey) continue
    const bucket = byHour.get(d.getHours()) ?? []
    bucket.push(p.aqi)
    byHour.set(d.getHours(), bucket)
  }

  return Array.from({ length: currentHour + 1 }, (_, hour) => {
    const bucket = byHour.get(hour)
    if (!bucket || bucket.length === 0) return { hour, aqi: null, score: null }
    const aqi = Math.round(bucket.reduce((sum, v) => sum + v, 0) / bucket.length)
    return { hour, aqi, score: aqiToScore(aqi) }
  })
}

export interface IndoorDaySlot {
  /** Local calendar date, YYYY-MM-DD */
  date: string
  aqi: number | null
  score: number | null
}

/** One slot per calendar day for the last `days` days including today,
 * oldest first, filled with that day's average logged estimate — a day
 * with no logged points is null (not logged), never fabricated. Used for
 * both the Week (days=7) and Month (days=30) tabs. */
export function getRecentDailySlots(days: number): IndoorDaySlot[] {
  const points = loadAll()
  const byDate = new Map<string, number[]>()
  for (const p of points) {
    const key = dateKeyFor(p.t)
    const bucket = byDate.get(key) ?? []
    bucket.push(p.aqi)
    byDate.set(key, bucket)
  }

  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const key = dateKeyFor(d.getTime())
    const bucket = byDate.get(key)
    if (!bucket || bucket.length === 0) return { date: key, aqi: null, score: null }
    const aqi = Math.round(bucket.reduce((sum, v) => sum + v, 0) / bucket.length)
    return { date: key, aqi, score: aqiToScore(aqi) }
  })
}
