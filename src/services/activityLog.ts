import type { Activity, ActivityPoint, ActivityType } from '../types'

/**
 * Foreground-only activity log, persisted to localStorage.
 *
 * Why localStorage and not a backend: this is the web-realistic version of
 * Respira's activity tracking (see README "Roadmap"). A native rebuild would
  * sync this to a server and to Health; for now everything lives on
 * the device the activity was recorded on.
 */

const ACTIVITIES_KEY = 'respira.activities.v1'

function readAll(): Activity[] {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(activities: Activity[]) {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities))
  } catch {
    // Storage full or unavailable (private browsing, etc.) — fail silently,
    // the in-memory session state still works for the current tab.
  }
}

/** Most recent first. */
export function listActivities(): Activity[] {
  return readAll().sort((a, b) => b.startedAt - a.startedAt)
}

/** An activity left `active` on disk means the tab reloaded/closed mid-run. */
export function getActiveActivity(): Activity | null {
  return readAll().find((a) => a.status === 'active') ?? null
}

export function startActivity(type: ActivityType): Activity {
  const activities = readAll()

  // Only one activity can be active at a time — auto-discard any stale
  // in-progress activity before starting a new one.
  for (const a of activities) {
    if (a.status === 'active') a.status = 'discarded'
  }

  const activity: Activity = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    startedAt: Date.now(),
    endedAt: null,
    points: [],
    status: 'active',
  }

  activities.push(activity)
  writeAll(activities)
  return activity
}

export function appendPoint(activityId: string, point: ActivityPoint): Activity | null {
  const activities = readAll()
  const activity = activities.find((a) => a.id === activityId)
  if (!activity || activity.status !== 'active') return null

  activity.points.push(point)
  writeAll(activities)
  return activity
}

export function stopActivity(activityId: string): Activity | null {
  const activities = readAll()
  const activity = activities.find((a) => a.id === activityId)
  if (!activity) return null

  activity.status = 'completed'
  activity.endedAt = Date.now()
  writeAll(activities)
  return activity
}

export function discardActivity(activityId: string): Activity | null {
  const activities = readAll()
  const activity = activities.find((a) => a.id === activityId)
  if (!activity) return null

  activity.status = 'discarded'
  activity.endedAt = Date.now()
  writeAll(activities)
  return activity
}

export function deleteActivity(activityId: string): void {
  writeAll(readAll().filter((a) => a.id !== activityId))
}

/** Great-circle distance between two points, in meters. */
function haversineMeters(a: ActivityPoint, b: ActivityPoint): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function activityDistanceMeters(activity: Activity): number {
  let total = 0
  for (let i = 1; i < activity.points.length; i++) {
    total += haversineMeters(activity.points[i - 1], activity.points[i])
  }
  return total
}

export function activityDurationMs(activity: Activity): number {
  const end = activity.endedAt ?? Date.now()
  return Math.max(0, end - activity.startedAt)
}

export function activityAverageAqi(activity: Activity): number | null {
  const values = activity.points
    .map((p) => p.nearestAqi)
    .filter((v): v is number => v != null)
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

export function activityPeakAqi(activity: Activity): number | null {
  const values = activity.points
    .map((p) => p.nearestAqi)
    .filter((v): v is number => v != null)
  if (values.length === 0) return null
  return Math.max(...values)
}
