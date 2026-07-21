import { AqiLevel } from '../types'
import { HealthProfile, isSensitiveGroup } from './profile'

// Calls our own /api/summary route — in dev that's the Vite proxy in
// vite.config.ts, in production it's the serverless function at
// api/summary.ts. Either way, ANTHROPIC_API_KEY is attached server-side and
// never ships in client code. The request/response shape here has to match
// those two handlers exactly: { aqi, level, forecastPeakAqi, sensitiveGroup,
// stationName?, pollutant? } in, { summary } (or { error }) out.
export interface SummaryInput {
  aqi: number
  level: AqiLevel
  forecastAqi: number
  healthProfile: HealthProfile | null
  /** Set when summarizing a specific map region the person tapped, rather
   *  than their own location's overall reading — lets the summary name the
   *  station and explain there's no per-station forecast. */
  stationName?: string
  pollutant?: string
  /** e.g. "PM2.5 62 (Moderate), OZONE 38 (Good)" — every pollutant AirNow
   *  reported for this station, only set when there's more than one, so
   *  the summary can mention a secondary pollutant worth knowing about
   *  instead of only ever naming the one driving the overall AQI. */
  pollutantBreakdown?: string
  hasForecast: boolean
  /** Which time-slider step the region reading came from: 'today',
   *  'tomorrow', an ISO past date, or null when there's no region
   *  selected. Tells the backend to say "was"/"is forecast to be" instead
   *  of always "is currently." */
  timeContext?: string | null
}

/** Throws on any failure — callers should catch and fall back to a local, non-AI summary. */
export async function fetchPlainLanguageSummary(input: SummaryInput): Promise<string> {
  const res = await fetch('/api/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aqi: input.aqi,
      level: input.level,
      forecastPeakAqi: input.forecastAqi,
      sensitiveGroup: input.healthProfile ? isSensitiveGroup(input.healthProfile) : false,
      stationName: input.stationName ?? null,
      pollutant: input.pollutant ?? null,
      pollutantBreakdown: input.pollutantBreakdown ?? null,
      hasForecast: input.hasForecast,
      timeContext: input.timeContext ?? null
    })
  })

  if (!res.ok) {
    throw new Error(`Summary request failed: ${res.status}`)
  }

  const data = await res.json()
  if (typeof data?.summary !== 'string' || !data.summary.trim()) {
    throw new Error('Summary response had no text content.')
  }
  return data.summary.trim()
}
