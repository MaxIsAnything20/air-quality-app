import { useEffect, useState } from 'react'
import { AqiLevel, AqiReading } from '../types'
import { fetchPlainLanguageSummary } from '../services/summary'
import { HealthProfile } from '../services/profile'
import { outdoorRecommendation } from '../services/aqiGuidance'
import { formatStepLabel, kindOfStep, tenseFor } from '../utils/timeSteps'

interface SummaryState {
  summary: string
  loading: boolean
  /** True when the AI backend wasn't reachable/configured and we fell back
   *  to a locally-built sentence — never leaves the UI with nothing to show. */
  usingFallback: boolean
}

function levelLabel(level: AqiLevel): string {
  return level === 'veryunhealthy' ? 'very unhealthy' : level === 'sensitive' ? 'unhealthy for sensitive groups' : level
}

function formatBreakdown(region: AqiReading | null): string | undefined {
  if (!region?.pollutants || region.pollutants.length < 2) return undefined
  return region.pollutants.map((p) => `${p.parameter} ${p.aqi} (${levelLabel(p.level)})`).join(', ')
}

function fallbackSummary(
  aqi: number,
  level: AqiLevel,
  forecastAqi: number,
  profile: HealthProfile | null,
  region: AqiReading | null,
  step: string | null
): string {
  const sensitive = !!profile && profile.conditions.length > 0
  const where = region ? ` at ${region.stationName}` : ''
  const breakdown = formatBreakdown(region)

  let sentence: string
  if (region) {
    const stepKind = step ? kindOfStep(step) : 'today'
    const verb = step ? tenseFor(step) : 'is currently'
    // Only worth a parenthetical when it's not "today" — otherwise it's
    // just noise repeating what "is currently" already says.
    const whenNote = stepKind !== 'today' ? ` (${formatStepLabel(step ?? 'today')})` : ''
    sentence = breakdown
      ? `Air quality${where}${whenNote} ${verb} ${levelLabel(level)} (AQI ${aqi}), driven by ${region.pollutant}. Full breakdown: ${breakdown}.`
      : `Air quality${where}${whenNote} ${verb} ${levelLabel(level)} (AQI ${aqi}, primary pollutant ${region.pollutant}).`
  } else {
    const worsening = forecastAqi > aqi + 20
    sentence = worsening
      ? `Air quality is currently ${levelLabel(level)} (AQI ${aqi}) and expected to worsen, reaching AQI ${forecastAqi}.`
      : `Air quality is currently ${levelLabel(level)} at AQI ${aqi}.`
  }

  const { advice, timeEstimate } = outdoorRecommendation(level, sensitive)
  const recommendation = timeEstimate
    ? `${advice} Rule of thumb (not an official EPA figure): ${timeEstimate} of prolonged outdoor exertion.`
    : advice

  return `${sentence} ${recommendation}`
}

/** Fetches a short AI-generated plain-language summary, falling back to a
 *  locally-built sentence (no API call) if the backend isn't configured or
 *  the request fails for any reason. Independent loading/error state from
 *  the rest of the app, same pattern as the smoke/fire/PurpleAir hooks.
 *
 *  When `region` is set (the person tapped a specific AQI monitor on the
 *  map), the summary describes that station's own reading instead of the
 *  overall location stats, and skips the forecast — AirNow doesn't publish
 *  a per-station forecast, only a regional one. `step` says which time
 *  slider position that region came from ('today' | 'tomorrow' | an ISO
 *  past date) — without it, a summary for a past day or tomorrow's
 *  forecast has no way to avoid describing itself as "current." */
export function useSummary(
  aqi: number,
  level: AqiLevel,
  forecastAqi: number,
  healthProfile: HealthProfile | null,
  // Set while the app is showing sample/fallback readings (e.g. AirNow
  // unreachable or no key configured) — skips the AI call entirely rather
  // than spending a request generating a sentence about made-up numbers.
  skipAiFetch = false,
  region: AqiReading | null = null,
  step: string | null = null
): SummaryState {
  const effectiveAqi = region ? region.value : aqi
  const effectiveLevel = region ? region.level : level

  const [state, setState] = useState<SummaryState>({
    summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step),
    loading: !skipAiFetch,
    usingFallback: true
  })

  useEffect(() => {
    if (skipAiFetch) {
      setState({
        summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step),
        loading: false,
        usingFallback: true
      })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    fetchPlainLanguageSummary({
      aqi: effectiveAqi,
      level: effectiveLevel,
      forecastAqi,
      healthProfile,
      stationName: region?.stationName,
      pollutant: region?.pollutant,
      pollutantBreakdown: formatBreakdown(region),
      hasForecast: !region,
      timeContext: region ? step : null
    })
      .then((summary) => {
        if (!cancelled) setState({ summary, loading: false, usingFallback: false })
      })
      .catch((err) => {
        console.warn('AI summary request failed, using local fallback:', err)
        if (!cancelled) {
          setState({
            summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step),
            loading: false,
            usingFallback: true
          })
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAqi, effectiveLevel, forecastAqi, healthProfile?.conditions.join(','), skipAiFetch, region?.stationName, step])

  return state
}
