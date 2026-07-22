import { useMemo, useState } from 'react'
import { aqiLevelFromValue, aqiToScore, scoreLabel } from '../types'
import type { PollutantReading } from '../types'
import { aqiColor } from '../aqiColors'

interface AirQualityForecastViewProps {
  onBack: () => void
  onUpgrade: () => void
  onViewMap: () => void
  currentAqi: number | null
  forecastPeakAqi: number | null
  pollutants: PollutantReading[]
}

interface HourPoint {
  hour: number
  aqi: number
  isNow: boolean
}

// A smooth curve anchored at two REAL numbers — a current AQI reading and
// today's real forecast peak — rather than 24 invented hourly
// measurements. AirNow's forecast is a single daily peak, not a timed
// curve, so this deliberately never claims to know *when* the peak
// happens: each hour's value just eases from the real "now" reading
// toward the real peak the further that hour is from now, in either
// direction, symmetric around "now" rather than picking an arbitrary
// peak hour. Reused for both the overall Clean air score curve and each
// pollutant's curve below — always paired with an explicit
// "estimated, not measured" caption in the UI.
function buildEstimatedHourlySeries(nowValue: number, peakValue: number, nowHour: number): HourPoint[] {
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

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function formatClockLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:00 ${period}`
}

// A real, computed day-range for whatever's left in the current calendar
// week (e.g. "Tue–Sat") — not placeholder copy — shown as a caption on
// the locked tab so the tease at least describes real upcoming days,
// even though no per-day forecast exists behind it yet.
function getRestOfWeekRangeLabel(): string {
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const now = new Date()
  const remainingCount = (7 - now.getDay()) % 7
  if (remainingCount <= 0) return ''
  const firstDay = new Date(now)
  firstDay.setDate(now.getDate() + 1)
  const lastDay = new Date(now)
  lastDay.setDate(now.getDate() + remainingCount)
  const firstLabel = short[firstDay.getDay()]
  const lastLabel = short[lastDay.getDay()]
  return remainingCount === 1 ? firstLabel : `${firstLabel}–${lastLabel}`
}

// Generic, factual descriptions of what each pollutant is and where it
// typically comes from — the same kind of static EPA-style educational
// copy already used elsewhere in this app (see the AI summary's
// cautionary-statement paraphrasing), not a claim about this specific
// reading. Falls back to just the parameter name if AirNow reports
// something not in this table.
const POLLUTANT_INFO: Record<string, { label: string; description: string }> = {
  'PM2.5': {
    label: 'PM2.5',
    description:
      'Fine particles under 2.5 microns — small enough to reach deep into the lungs and bloodstream. Outdoors they mainly come from vehicle exhaust, wildfire smoke, and combustion.'
  },
  PM10: {
    label: 'PM10',
    description:
      'Coarser particles under 10 microns, such as dust, pollen, and mold spores — can irritate the eyes, nose, and throat.'
  },
  OZONE: {
    label: 'Ozone (O₃)',
    description:
      'A gas formed when other pollutants react with sunlight — usually highest on hot, sunny afternoons rather than at night.'
  },
  O3: {
    label: 'Ozone (O₃)',
    description:
      'A gas formed when other pollutants react with sunlight — usually highest on hot, sunny afternoons rather than at night.'
  },
  NO2: {
    label: 'Nitrogen dioxide (NO₂)',
    description: 'A gas mainly from vehicle and power-plant combustion, linked to airway irritation.'
  },
  SO2: {
    label: 'Sulfur dioxide (SO₂)',
    description: 'A gas released by burning fuels that contain sulfur, such as coal, or by some industrial processes.'
  },
  CO: {
    label: 'Carbon monoxide (CO)',
    description: 'A colorless, odorless gas from incomplete combustion — mainly vehicle exhaust.'
  }
}

function pollutantInfo(parameter: string): { label: string; description: string } {
  return POLLUTANT_INFO[parameter] ?? { label: parameter, description: '' }
}

/** Simple SVG line + area chart for a pollutant's estimated hourly AQI
 * trend — deliberately plain (no external chart library), in AQI units
 * rather than µg/m³ concentration, since this codebase only has a
 * concentration↔AQI conversion table for PM2.5 (see pm25ToAqi in
 * types.ts), not the other pollutants AirNow reports. */
function PollutantTrendChart({ series }: { series: HourPoint[] }) {
  const width = 300
  const height = 90
  const maxAqi = Math.max(...series.map((p) => p.aqi), 10) * 1.15
  const stepX = width / (series.length - 1)
  const coords = series.map((p, i) => {
    const x = i * stepX
    const y = height - (p.aqi / maxAqi) * height
    return [x, y]
  })
  const linePath = `M${coords.map(([x, y]) => `${x},${y}`).join(' L')}`
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
      <path d={areaPath} fill="#D9922B" fillOpacity={0.15} />
      <path d={linePath} fill="none" stroke="#D9922B" strokeWidth={2} />
    </svg>
  )
}

/**
 * Respira's data source (AirNow) only ever gives a real current reading
 * plus a single real forecast peak for today — no true hourly curve and
 * no per-day forecast beyond today. So this screen:
 *  - Shows an hourly bar chart for TODAY only, built from
 *    buildEstimatedHourlySeries() above, clearly labeled as an estimate
 *    anchored on two real numbers (never presented as measured data).
 *    Tapping any bar shows that hour's estimated score as a tooltip and
 *    updates the summary card below.
 *  - Shows the same treatment per pollutant, anchored on that
 *    pollutant's real current AQI and the same overall forecast peak
 *    (explicitly captioned as not a pollutant-specific forecast).
 *  - Keeps every other day collapsed into a single locked "Rest of the
 *    week" tab, styled like every other premium teaser in this app —
 *    tapping it goes to the same non-functional Paywall flow as
 *    everything else, and deliberately does NOT "unlock" real per-day
 *    forecasts, because there's no real per-day data to show even then.
 */
export default function AirQualityForecastView({
  onBack,
  onUpgrade,
  onViewMap,
  currentAqi,
  forecastPeakAqi,
  pollutants
}: AirQualityForecastViewProps) {
  const nowHour = new Date().getHours()
  const restOfWeekRange = useMemo(() => getRestOfWeekRangeLabel(), [])
  const [selectedHour, setSelectedHour] = useState(nowHour)
  const [selectedPollutant, setSelectedPollutant] = useState<string | null>(pollutants[0]?.parameter ?? null)

  const series = useMemo(() => {
    if (currentAqi == null || forecastPeakAqi == null) return null
    return buildEstimatedHourlySeries(currentAqi, forecastPeakAqi, nowHour)
  }, [currentAqi, forecastPeakAqi, nowHour])

  const selectedPoint = series?.find((point) => point.hour === selectedHour) ?? null

  const activePollutant = pollutants.find((p) => p.parameter === selectedPollutant) ?? pollutants[0] ?? null
  const pollutantSeries = useMemo(() => {
    if (!activePollutant || forecastPeakAqi == null) return null
    return buildEstimatedHourlySeries(activePollutant.aqi, forecastPeakAqi, nowHour)
  }, [activePollutant, forecastPeakAqi, nowHour])

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-200 dark:border-night-600">
        <button onClick={onBack} aria-label="Back" className="w-7 h-7 flex items-center justify-center -ml-1">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-900 dark:text-night-100"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-base font-medium text-ink-900 dark:text-night-100 m-0">Air quality forecast</h1>
      </div>

      <div className="px-4 pt-4 pb-6">
        <div className="flex gap-2 mb-5">
          <button className="px-4 py-2 rounded-full text-sm font-medium bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900">
            Today
          </button>
          <button
            onClick={onUpgrade}
            className="flex-1 px-4 py-2.5 rounded-full bg-ink-100 dark:bg-night-700 text-ink-400 dark:text-night-400 flex flex-col items-center justify-center leading-tight"
          >
            <span className="text-sm font-medium flex items-center gap-1.5">
              Rest of the week
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D9922B" strokeWidth="2">
                <path d="M6 3h12l4 6-10 12L2 9Z" />
              </svg>
            </span>
            {restOfWeekRange && <span className="text-[10px] mt-0.5">{restOfWeekRange}</span>}
          </button>
        </div>

        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-3">Clean air score</h2>

        {series ? (
          <>
            <div className="flex items-end gap-[3px] h-40 mb-1">
              {series.map((point) => {
                const score = aqiToScore(point.aqi)
                const level = aqiLevelFromValue(point.aqi)
                const isSelected = point.hour === selectedHour
                return (
                  <button
                    key={point.hour}
                    onClick={() => setSelectedHour(point.hour)}
                    aria-label={`${formatHourLabel(point.hour)}: ${score}%`}
                    className="flex-1 h-full flex flex-col items-center justify-end relative"
                  >
                    {isSelected && (
                      <span
                        className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white px-2 py-0.5 rounded-full z-10"
                        style={{ backgroundColor: aqiColor[level] }}
                      >
                        {score}%
                      </span>
                    )}
                    <div
                      className="w-full rounded-full"
                      style={{
                        height: `${Math.max(6, score)}%`,
                        backgroundColor: aqiColor[level],
                        opacity: point.isNow || isSelected ? 1 : 0.75,
                        boxShadow: point.isNow ? '0 0 0 2px #1F4D3A' : undefined
                      }}
                    />
                  </button>
                )
              })}
            </div>

            <div className="flex gap-[3px] mb-1">
              {series.map((point) => (
                <div key={point.hour} className="flex-1 flex flex-col items-center">
                  {point.isNow && (
                    <>
                      <svg width="9" height="9" viewBox="0 0 24 24" className="fill-[#1F4D3A] dark:fill-[#8FC7A6]">
                        <path d="M12 4l8 16H4z" />
                      </svg>
                      <span className="text-[9px] font-medium text-[#1F4D3A] dark:text-[#8FC7A6]">Now</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between text-[10px] text-ink-400 dark:text-night-400 mb-4">
              <span>{formatHourLabel(0)}</span>
              <span>{formatHourLabel(6)}</span>
              <span>{formatHourLabel(12)}</span>
              <span>{formatHourLabel(18)}</span>
              <span>11 PM</span>
            </div>

            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mb-4">
              Estimated trend — based on your current reading ({currentAqi} AQI) and today's forecast peak (
              {forecastPeakAqi} AQI), not measured hour-by-hour data. Tap a bar to see its estimated score; only
              the "Now" bar reflects a real reading.
            </p>

            {selectedPoint && (
              <div
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between text-white mb-2"
                style={{ backgroundColor: aqiColor[aqiLevelFromValue(selectedPoint.aqi)] }}
              >
                <span className="text-sm font-medium">
                  {selectedPoint.isNow
                    ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : formatClockLabel(selectedPoint.hour)}
                </span>
                <span className="text-sm font-medium">
                  {scoreLabel(aqiToScore(selectedPoint.aqi))} {aqiToScore(selectedPoint.aqi)}%
                  {!selectedPoint.isNow && <span className="font-normal opacity-80"> · estimated</span>}
                </span>
              </div>
            )}

            <button
              onClick={onViewMap}
              className="text-xs font-medium text-[#1F4D3A] dark:text-[#8FC7A6] underline mb-2"
            >
              View live map & full details
            </button>
          </>
        ) : (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-10 m-0">
            No live air quality data available right now.
          </p>
        )}

        {pollutants.length > 0 && forecastPeakAqi != null && activePollutant && pollutantSeries && (
          <div className="mt-6 bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 rounded-2xl p-4">
            <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-3">Pollutant forecast</h2>

            <p className="text-xs text-ink-600 dark:text-night-200 mb-1.5">Pollutant</p>
            <div className="relative mb-3">
              <select
                value={activePollutant.parameter}
                onChange={(e) => setSelectedPollutant(e.target.value)}
                className="w-full appearance-none bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium rounded-xl px-3.5 py-3 pr-8"
              >
                {pollutants.map((p) => (
                  <option key={p.parameter} value={p.parameter}>
                    {pollutantInfo(p.parameter).label}
                  </option>
                ))}
              </select>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 dark:text-night-400"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            <PollutantTrendChart series={pollutantSeries} />

            <div className="flex justify-between text-[10px] text-ink-400 dark:text-night-400 mt-1 mb-3">
              <span>{formatHourLabel(0)}</span>
              <span>{formatHourLabel(6)}</span>
              <span>{formatHourLabel(12)}</span>
              <span>{formatHourLabel(18)}</span>
              <span>11 PM</span>
            </div>

            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mb-4">
              Estimated — anchored on the current {pollutantInfo(activePollutant.parameter).label} reading (
              {activePollutant.aqi} AQI) and today's overall forecast peak ({forecastPeakAqi} AQI). Not a
              pollutant-specific forecast, and shown in AQI units (this data source doesn't provide a
              concentration breakpoint table for every pollutant), not measured hour-by-hour data.
            </p>

            {pollutantInfo(activePollutant.parameter).description && (
              <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-3">
                <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0 mb-1">
                  About {pollutantInfo(activePollutant.parameter).label}
                </p>
                <p className="text-xs text-ink-600 dark:text-night-200 m-0">
                  {pollutantInfo(activePollutant.parameter).description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
