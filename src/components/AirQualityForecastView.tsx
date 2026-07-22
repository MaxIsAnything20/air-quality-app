import { useMemo } from 'react'
import { aqiLevelFromValue, aqiToScore, scoreLabel } from '../types'
import { aqiColor } from '../aqiColors'

interface AirQualityForecastViewProps {
  onBack: () => void
  onUpgrade: () => void
  currentAqi: number | null
  forecastPeakAqi: number | null
}

interface HourPoint {
  hour: number
  aqi: number
  isNow: boolean
}

// A smooth curve anchored at two REAL numbers — the current AQI reading
// and today's real forecast peak — rather than 24 invented hourly
// measurements. AirNow's forecast is a single daily peak, not a timed
// curve, so this deliberately never claims to know *when* the peak
// happens: each hour's value just eases from the real "now" reading
// toward the real peak the further that hour is from now, in either
// direction, symmetric around "now" rather than picking an arbitrary
// peak hour. Always paired with an explicit "estimated, not measured"
// caption in the UI below — see AirQualityForecastView.
function buildEstimatedHourlySeries(currentAqi: number, forecastPeakAqi: number, nowHour: number): HourPoint[] {
  const points: HourPoint[] = []
  for (let hour = 0; hour < 24; hour++) {
    const rawDist = Math.abs(hour - nowHour)
    const circularDist = Math.min(rawDist, 24 - rawDist)
    const t = circularDist / 12
    const aqi = currentAqi + (forecastPeakAqi - currentAqi) * t
    points.push({ hour, aqi: Math.round(aqi), isNow: hour === nowHour })
  }
  return points
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

// A real, computed day-range for whatever's left in the current calendar
// week (e.g. "Tue–Sat") — not placeholder copy — shown as a caption on
// the locked tab so the tease at least describes real upcoming days,
// even though no per-day forecast exists behind it yet (see the "Rest of
// the week" section below).
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

/**
 * Respira's data source (AirNow) only ever gives a real current reading
 * plus a single real forecast peak for today — no true hourly curve and
 * no per-day forecast beyond today. So this screen:
 *  - Shows an hourly bar chart for TODAY only, built from
 *    buildEstimatedHourlySeries() above, clearly labeled as an estimate
 *    anchored on two real numbers (never presented as measured data).
 *  - Keeps every other day collapsed into a single locked "Rest of the
 *    week" tab, styled like every other premium teaser in this app
 *    (AutoTrack, Routes' old paywall link, etc.) — tapping it goes to
 *    the same non-functional Paywall/Subscription Preview flow as
 *    everything else. It deliberately does NOT "unlock" into real
 *    per-day forecasts on any simulated purchase, because there is no
 *    real per-day forecast data to show even then — inventing one at
 *    that point would be exactly the kind of fabrication this app
 *    avoids everywhere else.
 */
export default function AirQualityForecastView({
  onBack,
  onUpgrade,
  currentAqi,
  forecastPeakAqi
}: AirQualityForecastViewProps) {
  const nowHour = new Date().getHours()
  const restOfWeekRange = useMemo(() => getRestOfWeekRangeLabel(), [])

  const series = useMemo(() => {
    if (currentAqi == null || forecastPeakAqi == null) return null
    return buildEstimatedHourlySeries(currentAqi, forecastPeakAqi, nowHour)
  }, [currentAqi, forecastPeakAqi, nowHour])

  // TypeScript can't infer from `series` being non-null that the
  // `currentAqi`/`forecastPeakAqi` props (captured in the closure above)
  // are non-null too, so the readout below reads its value straight off
  // the "now" point in the series instead of the raw props — which also
  // happens to be more correct, since that point's aqi *is* currentAqi
  // by construction.
  const nowPoint = series?.find((point) => point.isNow) ?? null

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
            <div className="flex items-end gap-[3px] h-36 mb-1">
              {series.map((point) => {
                const score = aqiToScore(point.aqi)
                const level = aqiLevelFromValue(point.aqi)
                return (
                  <div key={point.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-full"
                      style={{
                        height: `${Math.max(6, score)}%`,
                        backgroundColor: aqiColor[level],
                        opacity: point.isNow ? 1 : 0.85,
                        boxShadow: point.isNow ? '0 0 0 2px #1F4D3A' : undefined
                      }}
                    />
                  </div>
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
              {forecastPeakAqi} AQI), not measured hour-by-hour data. Only the "Now" bar reflects a real
              reading.
            </p>

            {nowPoint && (
              <div
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between text-white"
                style={{ backgroundColor: aqiColor[aqiLevelFromValue(nowPoint.aqi)] }}
              >
                <span className="text-sm font-medium">
                  {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="text-sm font-medium">
                  {scoreLabel(aqiToScore(nowPoint.aqi))} {aqiToScore(nowPoint.aqi)}%
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-10 m-0">
            No live air quality data available right now.
          </p>
        )}
      </div>
    </div>
  )
}
