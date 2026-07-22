import { DailyExposure, aqiLevelFromValue } from '../types'

// Real monthly history, logged client-side as live AirNow readings come in.
// AirNow's historical endpoint returns one day/reporting-area per call,
// which isn't practical to call N times just to backfill a chart, so this
// takes the README's other suggested approach: keep your own rolling log.
// Trade-off worth knowing: history only starts accumulating from whenever
// a given browser/device first opens the app with a working AirNow key —
// there's no way to retroactively fill in days before that.
const STORAGE_KEY = 'airtrack:dailyHistory'
// Keep a bit more than a calendar month so days at the start of a new
// month don't get pruned before they've had a chance to render.
const MAX_DAYS_KEPT = 45

interface StoredEntry {
  /** Local calendar date, YYYY-MM-DD */
  date: string
  aqi: number
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateKeyDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadAll(): StoredEntry[] {
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

function saveAll(entries: StoredEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded, private browsing, etc — best-effort only.
  }
}

/**
 * Records today's AQI reading. Call this each time a real (non-sample)
 * AirNow reading comes in. Keeps the *worst* reading seen so far today
 * rather than the latest one, since "how bad did it get today" is what
 * the monthly chart and the days-unhealthy stat actually care about.
 */
export function recordDailyReading(aqi: number): void {
  if (!Number.isFinite(aqi)) return
  const entries = loadAll()
  const key = todayKey()
  const existing = entries.find((e) => e.date === key)
  if (existing) {
    existing.aqi = Math.max(existing.aqi, aqi)
  } else {
    entries.push({ date: key, aqi })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date))
  saveAll(entries.slice(-MAX_DAYS_KEPT))
}

/** Real logged history for the current calendar month, oldest day first. */
export function getMonthlyHistory(): DailyExposure[] {
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return loadAll()
    .filter((e) => e.date.startsWith(monthPrefix))
    .map((e) => ({ date: e.date, aqi: e.aqi, level: aqiLevelFromValue(e.aqi) }))
}

/**
 * Real logged history for the last `days` calendar days including today,
 * oldest first. Unlike getMonthlyHistory, this ignores calendar-month
 * boundaries — used by the personal exposure score, where a rolling
 * 7-day window near the start of a month shouldn't lose the last few
 * days of the prior month.
 */
export function getRecentDailyHistory(days: number): DailyExposure[] {
  const cutoffKey = dateKeyDaysAgo(Math.max(0, days - 1))
  return loadAll()
    .filter((e) => e.date >= cutoffKey)
    .map((e) => ({ date: e.date, aqi: e.aqi, level: aqiLevelFromValue(e.aqi) }))
}

/** The logged ambient reading for one specific calendar date (YYYY-MM-DD),
 * or null if that day was never logged — used by the "My activities"
 * per-day score view. */
export function getDailyEntry(dateKey: string): DailyExposure | null {
  const entry = loadAll().find((e) => e.date === dateKey)
  return entry ? { date: entry.date, aqi: entry.aqi, level: aqiLevelFromValue(entry.aqi) } : null
}

/** Count of logged days this month at "Unhealthy" (AQI 151+) or worse. */
export function getDaysUnhealthyThisMonth(): number {
  return getMonthlyHistory().filter((d) => d.aqi > 150).length
}
