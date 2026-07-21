import { AqiReading } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'
import { formatStepLabel, kindOfStep } from '../utils/timeSteps'

interface SummaryCardProps {
  summary: string
  loading: boolean
  usingFallback: boolean
  region: AqiReading | null
  step: string | null
  onClearRegion: () => void
}

export default function SummaryCard({ summary, loading, usingFallback, region, step, onClearRegion }: SummaryCardProps) {
  const isLive = !step || kindOfStep(step) === 'today'

  return (
    <div className="px-4 py-3 border-b border-ink-200 dark:border-night-600">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0 truncate">
            {region ? region.stationName : 'Plain-language summary'}
          </p>
          {region && !isLive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 dark:bg-night-700 text-ink-600 dark:text-night-200 shrink-0">
              {formatStepLabel(step as string)}
            </span>
          )}
        </div>
        {region && (
          <button
            onClick={onClearRegion}
            className="text-[11px] text-ink-400 dark:text-night-400 underline shrink-0"
          >
            Back to your location
          </button>
        )}
      </div>

      {/* AirNow itself reports (and shows) every pollutant a station
          measures, not just whichever one is driving the overall AQI —
          e.g. a station can read "Moderate" on ozone while also having an
          elevated PM2.5 value worth knowing about. Only shown for a
          selected station since that's the only place we have the full
          per-station breakdown rather than just the worst reading. */}
      {region?.pollutants && region.pollutants.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {region.pollutants.map((p) => (
            <span
              key={p.parameter}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-white"
              style={{ backgroundColor: aqiColor[p.level] }}
              title={aqiLevelLabel[p.level]}
            >
              {p.parameter} {p.aqi}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-600 dark:text-night-200 m-0">
        {loading ? 'Generating…' : summary}
      </p>
      {!loading && (
        <p className="text-[10px] text-ink-400 dark:text-night-400 m-0 mt-1">
          Category guidance is paraphrased from EPA/AirNow's published cautionary statements. Any
          specific minute estimate is a rough rule of thumb, not an official EPA figure — not a
          substitute for medical advice.
          {usingFallback && ' Generated locally — AI summary unavailable (needs ANTHROPIC_API_KEY set server-side).'}
        </p>
      )}
    </div>
  )
}
