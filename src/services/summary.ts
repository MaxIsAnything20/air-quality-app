import { AqiLevel } from '../types'
import { HealthProfile, isSensitiveGroup } from './profile'

export interface SummaryInput {
  aqi: number
  level: AqiLevel
  forecastAqi: number
  healthProfile: HealthProfile | null
  stationName?: string
  pollutant?: string
  pollutantBreakdown?: string
  hasForecast: boolean
  timeContext?: string | null
  /** One-sentence factual note from services/divergence.ts when nearby
   *  PurpleAir sensors read notably worse than the official station —
   *  handed to the model as extra grounding context, same discipline as
   *  every other number in this prompt ("only use what's given"). */
  divergenceNote?: string
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
      timeContext: input.timeContext ?? null,
      divergenceNote: input.divergenceNote ?? null
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
