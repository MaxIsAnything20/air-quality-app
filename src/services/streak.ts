import type { Activity } from '../types'

/**
 * A day-streak counter built only from real, completed activities already
 * saved in this browser (see services/activityLog.ts) — no server-side
 * account, no invented milestones, just "how many days in a row did you
 * log something."
 *
 * The streak counts backward from today. If today doesn't have a
 * completed activity yet, that alone doesn't break the streak (the day
 * isn't over) — it only breaks once a full day passes with nothing
 * logged.
 */
export function computeActivityStreak(activities: Activity[]): number {
  const completedDays = new Set(
    activities
      .filter((activity) => activity.status === 'completed')
      .map((activity) => new Date(activity.startedAt).toDateString())
  )

  if (completedDays.size === 0) return 0

  const cursor = new Date()
  if (!completedDays.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (completedDays.has(cursor.toDateString())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** The one real, honestly-earnable badge in the app right now — completing
 * a single tracked activity. More badges can be added here as more
 * genuine milestones exist to check against, but nothing is invented
 * ahead of having real data to back it. */
export const FIRST_ACTIVITY_BADGE = {
  id: 'first-activity',
  label: 'First activity',
  description: 'Complete your first tracked activity',
}

export function hasEarnedFirstActivityBadge(activities: Activity[]): boolean {
  return activities.some((activity) => activity.status === 'completed')
}

/**
 * A second real badge, tied to the Events backend (api/events.ts,
 * services/events.ts) rather than local activity history — earned the
 * first time this device checks in to any event it created or joined.
 * Takes a loosely-typed array (just the one field it needs) instead of
 * importing services/events.ts's MyEvent type, to keep this file's only
 * dependency the shared Activity type.
 */
export const EVENT_CHECKIN_BADGE = {
  id: 'event-checkin',
  label: 'Event check-in',
  description: 'Check in to your first event',
}

export function hasEarnedEventCheckinBadge(events: { checkedInAt: number | null }[]): boolean {
  return events.some((event) => event.checkedInAt != null)
}
