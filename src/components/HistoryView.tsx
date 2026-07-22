import { DailyExposure, ExposureStats } from '../types'
import { aqiColor } from '../aqiColors'
import ExposureScoreCard from './ExposureScoreCard'
import type { ExposureScoreResult } from '../services/exposureScore'

interface HistoryViewProps {
  monthlyHistory: DailyExposure[]
  stats: ExposureStats
  usingSampleData: boolean
  exposureScore: ExposureScoreResult | null
}

const LEVEL_LABELS: { level: DailyExposure['level']; label: string }[] = [
  { level: 'good', label: 'Good' },
  { level: 'moderate', label: 'Moderate' },
  { level: 'sensitive', label: 'Sensitive groups' },
  { level: 'unhealthy', label: 'Unhealthy' },
  { level: 'veryunhealthy', label: 'Very unhealthy' },
  { level: 'hazardous', label: 'Hazardous' }
]

const now = new Date()
const monthLabel = now.toLocaleDateString('en-US', { month: 'long' })
const daysElapsedThisMonth = now.getDate()

function dateKey(day: number): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function HistoryView({ monthlyHistory, stats, usingSampleData, exposureScore }: HistoryViewProps) {
  const loggedCount = monthlyHistory.length
  const hasAnyData = loggedCount > 0

  // historyLog.ts only stores days you actually logged — no fabricated
  // entry for a day you never opened the app. That's the right call for
  // the underlying data, but rendering those entries edge-to-edge (as
  // this used to) packs scattered days together and makes a handful of
  // logged days out of three weeks look like a tidy, consecutive stretch.
  // Building one slot per *calendar* day elapsed this month — filled or
  // empty — puts gaps where they actually are.
  const loggedByDate = new Map(monthlyHistory.map((d) => [d.date, d]))
  const daySlots = Array.from({ length: daysElapsedThisMonth }, (_, i) => loggedByDate.get(dateKey(i + 1)) ?? null)

  const maxAqi = hasAnyData ? Math.max(...monthlyHistory.map((d) => d.aqi), 100) : 100
  const average = hasAnyData ? Math.round(monthlyHistory.reduce((sum, d) => sum + d.aqi, 0) / loggedCount) : null
  const worst = monthlyHistory.reduce<DailyExposure | null>(
    (worstSoFar, d) => (!worstSoFar || d.aqi > worstSoFar.aqi ? d : worstSoFar),
    null
  )

  const hasGaps = hasAnyData && loggedCount < daysElapsedThisMonth

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">
        {monthLabel} exposure
      </h2>
      <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
        Daily peak AQI for your location. Logged {loggedCount} of {daysElapsedThisMonth} day
        {daysElapsedThisMonth === 1 ? '' : 's'} so far this month.
        {usingSampleData
          ? ' Showing sample history — connect a live AQI source (set AIRNOW_API_KEY) to start logging real days.'
          : hasGaps
            ? " Logging only happens on days you actually open the app — the gaps below are days you didn't, not days with good air quality."
            : ''}
      </p>

      {/* Personal exposure score sits above the calendar-month stats —
          it's a rolling 7-day figure that also folds in tracked
          activities, so it answers a different question ("how has my
          actual recent exposure been") than the monthly chart below it
          ("what has this month's air quality looked like"). */}
      <ExposureScoreCard score={exposureScore} usingSampleData={usingSampleData} />

      <div className="flex gap-2.5 mb-5">
        <div className="flex-1 bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">This month</p>
          <p className="text-xl font-medium text-ink-900 dark:text-night-100 m-0 mt-1">
            {stats.daysUnhealthyThisMonth} days
          </p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">unhealthy or worse</p>
        </div>
        <div className="flex-1 bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">Average AQI</p>
          <p className="text-xl font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{average ?? '—'}</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">
            {hasAnyData ? `of ${loggedCount} logged day${loggedCount === 1 ? '' : 's'}` : 'no logged days yet'}
          </p>
        </div>
        <div className="flex-1 bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">Peak day</p>
          <p className="text-xl font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{worst?.aqi ?? '—'}</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">
            {worst ? new Date(worst.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : ''}
          </p>
        </div>
      </div>

      <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-3 mb-4">
        {hasAnyData ? (
          <>
            <div className="flex items-end gap-[3px] h-32">
              {daySlots.map((day, i) => {
                if (!day) {
                  // Empty slot for a day with no logged entry — deliberately
                  // NOT the same visual weight as a real "Good" bar, so a
                  // gap can't be mistaken for a great-air-quality day.
                  return (
                    <div
                      key={dateKey(i + 1)}
                      className="flex-1 rounded-sm min-w-[4px] h-[6%] bg-ink-200 dark:bg-night-600"
                      title={`${new Date(dateKey(i + 1)).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}: not logged`}
                    />
                  )
                }
                const heightPct = Math.max(6, Math.round((day.aqi / maxAqi) * 100))
                return (
                  <div
                    key={day.date}
                    className="flex-1 rounded-sm min-w-[4px]"
                    style={{ height: `${heightPct}%`, backgroundColor: aqiColor[day.level] }}
                    title={`${new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}: AQI ${day.aqi}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-ink-400 dark:text-night-400">1</span>
              <span className="text-[10px] text-ink-400 dark:text-night-400">{daysElapsedThisMonth}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-8 m-0">
            No days logged yet this month — open the app with a live AQI source connected to start.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {LEVEL_LABELS.map((item) => (
          <div key={item.level} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: aqiColor[item.level] }}
            />
            <span className="text-[11px] text-ink-600 dark:text-night-200">{item.label}</span>
          </div>
        ))}
        {hasGaps && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-ink-200 dark:bg-night-600" />
            <span className="text-[11px] text-ink-600 dark:text-night-200">Not logged</span>
          </div>
        )}
      </div>
    </div>
  )
}
