import { AqiReading, FieldReport, SmokePolygon } from '../types'

// Backs the map's time slider "past days" steps. There's no reliable,
// documented way to pull NOAA's HMS smoke/fire archive by specific past
// date (their filename convention changed in 2022, and what's exposed
// publicly is really a directory of files / an interactive viewer, not a
// stable per-date REST endpoint) — building on that would risk a slider
// that silently breaks. This instead snapshots the *real* map state once
// per day, as you actually use the app, in localStorage. Same trade-off as
// historyLog.ts: no data for days before you started using the app, and
// nothing here is fabricated.
const STORAGE_KEY = 'airtrack:map-snapshots-v1'
const MAX_DAYS_KEPT = 14

export interface MapSnapshot {
  aqiReadings: AqiReading[]
  smokePolygons: SmokePolygon[]
  fireReports: FieldReport[]
}

interface SnapshotLog {
  [isoDate: string]: MapSnapshot
}

function isoDateFor(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function readLog(): SnapshotLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeLog(log: SnapshotLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {
    // Storage quota / private browsing — snapshots are a nice-to-have,
    // losing one isn't worth crashing over.
  }
}

/** Overwrites today's snapshot with the latest real map state seen — this
 *  represents "what the map looked like last time you had the app open
 *  today," not a running peak (unlike historyLog.ts's AQI number, a full
 *  set of map layers doesn't have one obvious "worst" moment to keep). */
export function recordMapSnapshot(snapshot: MapSnapshot, date: Date = new Date()) {
  const log = readLog()
  log[isoDateFor(date)] = snapshot

  // Bound storage growth — keep only the most recent MAX_DAYS_KEPT entries.
  const dates = Object.keys(log).sort()
  if (dates.length > MAX_DAYS_KEPT) {
    for (const staleDate of dates.slice(0, dates.length - MAX_DAYS_KEPT)) {
      delete log[staleDate]
    }
  }

  writeLog(log)
}

export function getMapSnapshot(isoDate: string): MapSnapshot | null {
  return readLog()[isoDate] ?? null
}

/** All logged dates except today, oldest first — the "past" steps of the slider. */
export function listPastSnapshotDates(now: Date = new Date()): string[] {
  const today = isoDateFor(now)
  return Object.keys(readLog())
    .filter((d) => d !== today)
    .sort()
}
