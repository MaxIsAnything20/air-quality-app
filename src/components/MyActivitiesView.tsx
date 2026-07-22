import { useState } from 'react'
import { Activity, ACTIVITY_TYPE_LABELS } from '../types'
import { computeExposureScore } from '../services/exposureScore'
import { getDailyEntry } from '../services/historyLog'
import { activityDurationMs } from '../services/activityLog'
import ScreenHeader from './ScreenHeader'

interface MyActivitiesViewProps {
  onBack: () => void
  activities: Activity[]
  sensitiveGroup: boolean
}

function dateKeyFor(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKeyFor(a) === dateKeyFor(b)
}

function scoreRingColor(score: number): string {
  if (score >= 80) return '#2F6B4F'
  if (score >= 60) return '#5B8C51'
  if (score >= 40) return '#D9922B'
  if (score >= 20) return '#C97A3B'
  return '#B3462C'
}

export default function MyActivitiesView({ onBack, activities, sensitiveGroup }: MyActivitiesViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const today = new Date()
  const isToday = isSameDay(selectedDate, today)
  const dateKey = dateKeyFor(selectedDate)

  // Only completed activities count toward the score and the list below —
  // matches computeExposureScore's own filtering, so the ring and the list
  // never disagree about what happened this day.
  const dayActivities = activities.filter(
    (a) => a.status === 'completed' && isSameDay(new Date(a.startedAt), selectedDate)
  )
  const dailyEntry = getDailyEntry(dateKey)

  const result = computeExposureScore(dailyEntry ? [dailyEntry] : [], dayActivities, sensitiveGroup)

  const goToPrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
  }

  const goToNextDay = () => {
    if (isToday) return
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
  }

  const dateLabel = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  const ringColor = result ? scoreRingColor(result.score) : '#9CA3AF'
  const circumference = 2 * Math.PI * 54
  const dashOffset = result ? circumference * (1 - result.score / 100) : circumference

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-night-900">
      <ScreenHeader title="My activities" onBack={onBack} />

      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={goToPrevDay}
          aria-label="Previous day"
          className="w-8 h-8 flex items-center justify-center rounded-full text-ink-600 dark:text-night-200 hover:bg-ink-100 dark:hover:bg-night-800"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-medium text-ink-900 dark:text-night-100">{dateLabel}</span>
        <button
          onClick={goToNextDay}
          disabled={isToday}
          aria-label="Next day"
          className="w-8 h-8 flex items-center justify-center rounded-full text-ink-600 dark:text-night-200 hover:bg-ink-100 dark:hover:bg-night-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center py-6">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-ink-100 dark:text-night-700" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold text-ink-900 dark:text-night-100">
              {result ? result.score : '—'}
            </span>
            <span className="text-xs text-ink-400 dark:text-night-400">{result ? result.label : 'No data'}</span>
          </div>
        </div>
        {!dailyEntry && dayActivities.length === 0 && (
          <p className="text-xs text-ink-400 dark:text-night-400 mt-3 px-8 text-center">
            No ambient reading or activities logged for this day yet.
          </p>
        )}
      </div>

      <div className="px-4 pb-3">
        <div className="rounded-2xl bg-ink-100/60 dark:bg-night-800 px-4 py-3">
          <p className="text-xs font-medium text-ink-600 dark:text-night-200 mb-1">AutoTrack Insights</p>
          <p className="text-xs text-ink-400 dark:text-night-400 leading-relaxed">
            {dayActivities.length > 0
              ? `${dayActivities.length} activit${dayActivities.length === 1 ? 'y' : 'ies'} logged this day, factored into the score above.`
              : 'AutoTrack passive tracking is a Premium feature and is not enabled. Log activities manually from the Activity tab.'}
          </p>
        </div>
      </div>

      <div className="px-4 pb-6">
        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-2">Activities</h2>
        {dayActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 dark:border-night-600 px-4 py-6 text-center">
            <p className="text-xs text-ink-400 dark:text-night-400">No activities recorded for this day</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayActivities.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-night-600 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-night-100">{ACTIVITY_TYPE_LABELS[a.type]}</p>
                  <p className="text-xs text-ink-400 dark:text-night-400">
                    {new Date(a.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    {' · '}
                    {Math.round(activityDurationMs(a) / 60000)} min
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
