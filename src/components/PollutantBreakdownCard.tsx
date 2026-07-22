import { useFullPollutantBreakdown } from '../hooks/useFullPollutantBreakdown'
import { aqiColor, aqiLevelLabel } from '../aqiColors'

interface PollutantBreakdownCardProps {
  lat: number
  lng: number
  usingSampleData: boolean
}

/** Full 5-pollutant (plus CO) breakdown sourced from Open-Meteo — see
 * services/openMeteoAirQuality.ts for why this exists alongside AirNow's
 * own pollutant badges in SummaryCard.tsx: AirNow only reports whatever
 * a nearby physical station measures (usually just PM2.5 + ozone), while
 * this always returns all six from a global model. Clearly labeled as a
 * model estimate, not a station reading, so it reads as a supplement
 * rather than a competing "real" number. */
export default function PollutantBreakdownCard({ lat, lng, usingSampleData }: PollutantBreakdownCardProps) {
  const { data, loading } = useFullPollutantBreakdown(usingSampleData ? null : lat, usingSampleData ? null : lng)

  if (usingSampleData) return null
  if (!loading && !data) return null

  return (
    <div className="px-4 py-3 border-b border-ink-200 dark:border-night-600">
      <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0 mb-1.5">Full pollutant breakdown</p>

      {loading && !data && <p className="text-xs text-ink-400 dark:text-night-400 m-0">Loading…</p>}

      {data && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {data.pollutants.map((p) => (
              <span
                key={p.parameter}
                className="text-xs font-semibold px-2.5 py-1 rounded-full text-white shadow-sm"
                style={{ backgroundColor: aqiColor[p.level] }}
                title={aqiLevelLabel[p.level]}
              >
                {p.parameter} <span className="tabular-nums">{p.aqi}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-ink-400 dark:text-night-400 m-0 mt-1.5">
            PM2.5, PM10, NO2, O3, SO2 and CO from Open-Meteo's global air quality model —
            fills in pollutants AirNow's own nearby station often doesn't report. Modeled, not a
            direct sensor reading.
          </p>
        </>
      )}
    </div>
  )
}
