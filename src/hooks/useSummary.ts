import { useEffect, useState } from 'react'
import { AqiLevel, AqiReading } from '../types'
import { fetchPlainLanguageSummary } from '../services/summary'
import { HealthProfile } from '../services/profile'
import { outdoorRecommendation } from '../services/aqiGuidance'
import { formatStepLabel, kindOfStep, tenseFor } from '../utils/timeSteps'

interface SummaryState {
  summary: string
  loading: boolean
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
  step: string | null,
  divergenceNote: string | null
): string {
  const sensitive = !!profile && profile.conditions.length > 0
  const where = region ? ` at ${region.stationName}` : ''
  const breakdown = formatBreakdown(region)

  let sentence: string
  if (region) {
    const stepKind = step ? kindOfStep(step) : 'today'
    const verb = step ? tenseFor(step) : 'is currently'
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

  // Only appended locally when there's no AI backend — the AI path hands
  // this same note to the model as prompt context instead (see
  // services/summary.ts / api/summary.ts) so it can be woven in more
  // naturally rather than tacked on as a separate sentence.
  const divergenceSentence = divergenceNote ? ` Heads up: ${divergenceNote}` : ''

  return `${sentence} ${recommendation}${divergenceSentence}`
}

/** Fetches a short AI-generated plain-language summary, falling back to a
 *  locally-built sentence (no API call) if the backend isn't configured or
 *  the request fails for any reason.
 *
 *  `divergenceNote` (from services/divergence.ts) is optional grounding
 *  context — when nearby PurpleAir sensors read notably worse than the
 *  official station, this is a one-sentence factual note the AI is asked
 *  to weave in if relevant, same "only use the numbers given" discipline
 *  as everything else in the prompt. */
export function useSummary(
  aqi: number,
  level: AqiLevel,
  forecastAqi: number,
  healthProfile: HealthProfile | null,
  skipAiFetch = false,
  region: AqiReading | null = null,
  step: string | null = null,
  divergenceNote: string | null = null
): SummaryState {
  const effectiveAqi = region ? region.value : aqi
  const effectiveLevel = region ? region.level : level

  const [state, setState] = useState<SummaryState>({
    summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step, divergenceNote),
    loading: !skipAiFetch,
    usingFallback: true
  })

  useEffect(() => {
    if (skipAiFetch) {
      setState({
        summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step, divergenceNote),
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
      timeContext: region ? step : null,
      divergenceNote: divergenceNote ?? undefined
    })
      .then((summary) => {
        if (!cancelled) setState({ summary, loading: false, usingFallback: false })
      })
      .catch((err) => {
        console.warn('AI summary request failed, using local fallback:', err)
        if (!cancelled) {
          setState({
            summary: fallbackSummary(effectiveAqi, effectiveLevel, forecastAqi, healthProfile, region, step, divergenceNote),
            loading: false,
            usingFallback: true
          })
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAqi, effectiveLevel, forecastAqi, healthProfile?.conditions.join(','), skipAiFetch, region?.stationName, step, divergenceNote])

  return state
}
