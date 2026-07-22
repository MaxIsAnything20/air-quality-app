import type { ExposureScoreResult } from '../services/exposureScore'

interface ExposureScoreCardProps {
  score: ExposureScoreResult | null
  usingSampleData: boolean
}

// A distinct scale from AQI's own good/moderate/.../hazardous colors —
// this is a different axis (a 0-100 personal score, not an AQI category)
// and reusing aqiColor here would visually imply it's the same scale.
const LABEL_COLOR: Record<ExposureScoreResult['label'], string> = {
  Excellent: '#3B9E5F',
  Good: '#7FAE4E',
  Fair: '#C99A2E',
  Poor: '#D2762E',
  'Very poor': '#C24545'
}

export default function ExposureScoreCard({ score, usingSampleData }: ExposureScoreCardProps) {
  // The map tab already has its own sample-data notice when AIRNOW_API_KEY
  // isn't configured — a second one here would just repeat it, and a score
  // built entirely from fabricated readings isn't worth showing anyway.
  if (usingSampleData) return null

  return (
    <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-4 py-4 mb-4">
      <p className="text-xs text-ink-600 dark:text-night-200 m-0 mb-1.5">
        Personal exposure score · last 7 days
      </p>

      {score ? (
        <>
          <div className="flex items-baseline gap-2">
            <span
              className="text-4xl font-mono font-medium"
              style={{ color: LABEL_COLOR[score.label] }}
            >
              {score.score}
            </span>
            <span className="text-sm font-medium text-ink-900 dark:text-night-100">{score.label}</span>
          </div>
          <p className="text-xs text-ink-600 dark:text-night-200 m-0 mt-1.5">{score.detail}</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-1">
            Based on {score.daysConsidered} logged day{score.daysConsidered === 1 ? '' : 's'}
            {score.activitiesConsidered > 0
              ? ` and ${score.activitiesConsidered} tracked activit${score.activitiesConsidered === 1 ? 'y' : 'ies'}`
              : ''}
            .
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          Not enough data yet — log a few days or track an activity to see your score.
        </p>
      )}
    </div>
  )
}
