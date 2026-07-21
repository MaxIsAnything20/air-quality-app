import { AqiLevel } from '../types'

// Two different levels of "sourced" here — don't blur them:
//
// `generalAdvice` / `sensitiveAdvice` are paraphrased from EPA/AirNow's
// actually-published Cautionary Statements and Activity Guides
// (airnow.gov/aqi/aqi-basics, airnow.gov's Activity Guides for ozone and
// particle pollution). EPA's own wording is qualitative — "reduce
// prolonged or heavy exertion," "take more breaks," "avoid all outdoor
// physical activity" — not tied to a specific clock time.
//
// `generalMaxMinutes` / `sensitiveMaxMinutes` are NOT official EPA
// figures. EPA doesn't publish a "safe for N minutes" number for these
// categories. These are a made-up-but-reasonable illustrative estimate,
// included so the recommendation is concrete instead of just "reduce
// exertion" with no sense of scale — but they should be labeled as a rule
// of thumb, never as EPA guidance, anywhere this is surfaced (UI copy or
// the AI prompt in api/summary.ts / vite.config.ts).
export interface AqiGuidance {
  /** Advice for the general public at this category — paraphrased EPA/AirNow language. */
  generalAdvice: string
  /** Extra advice specifically for EPA-defined sensitive groups (asthma,
   *  heart/lung disease, older adults, children, pregnant people, outdoor
   *  workers) — empty string when there's nothing beyond generalAdvice.
   *  Also paraphrased EPA/AirNow language. */
  sensitiveAdvice: string
  /** NOT an EPA figure — see file header. A rough, illustrative ceiling on
   *  prolonged/heavy outdoor exertion in minutes for the general public.
   *  `null` means no meaningful limit at this level. */
  generalMaxMinutes: number | null
  /** NOT an EPA figure — see file header. Same idea, sensitive groups. */
  sensitiveMaxMinutes: number | null
}

export const AQI_GUIDANCE: Record<AqiLevel, AqiGuidance> = {
  good: {
    generalAdvice: 'Air quality poses little or no risk — a good day for any outdoor activity.',
    sensitiveAdvice: '',
    generalMaxMinutes: null,
    sensitiveMaxMinutes: null
  },
  moderate: {
    generalAdvice: 'Air quality is acceptable for most people and most outdoor activity.',
    sensitiveAdvice:
      'If you\'re unusually sensitive to air pollution, consider taking more breaks during prolonged outdoor exertion.',
    generalMaxMinutes: null,
    sensitiveMaxMinutes: 120
  },
  sensitive: {
    generalAdvice: 'Most people can be outside as usual; watch for symptoms like coughing during longer activity.',
    sensitiveAdvice:
      'Sensitive groups (asthma, heart or lung disease, older adults, children, pregnant people, outdoor workers) should take more breaks and reduce prolonged or heavy outdoor exertion.',
    generalMaxMinutes: null,
    sensitiveMaxMinutes: 60
  },
  unhealthy: {
    generalAdvice: 'Everyone should reduce prolonged or heavy outdoor exertion — keep it to shorter, lighter activity.',
    sensitiveAdvice: 'Sensitive groups should avoid prolonged or heavy outdoor exertion altogether; move activity indoors if possible.',
    generalMaxMinutes: 30,
    sensitiveMaxMinutes: 0
  },
  veryunhealthy: {
    generalAdvice: 'Everyone should avoid prolonged or heavy outdoor exertion; keep outdoor time short.',
    sensitiveAdvice: 'Sensitive groups should avoid all outdoor physical activity and stay indoors.',
    generalMaxMinutes: 15,
    sensitiveMaxMinutes: 0
  },
  hazardous: {
    generalAdvice: 'Everyone should avoid all outdoor physical activity — stay indoors with windows closed if possible.',
    sensitiveAdvice: 'Sensitive groups should remain indoors and keep exertion to a minimum, indoors or out.',
    generalMaxMinutes: 0,
    sensitiveMaxMinutes: 0
  }
}

/** One combined, plain-language recommendation for a given level and
 *  whether the reader is in a sensitive group. Returns the EPA-paraphrased
 *  advice and the illustrative time estimate as SEPARATE strings so
 *  callers can label them differently (e.g. the time estimate needs a
 *  "rule of thumb, not an official figure" caveat wherever it's shown). */
export function outdoorRecommendation(
  level: AqiLevel,
  sensitive: boolean
): { advice: string; timeEstimate: string | null } {
  const g = AQI_GUIDANCE[level]
  const advice = sensitive && g.sensitiveAdvice ? g.sensitiveAdvice : g.generalAdvice
  const maxMinutes = sensitive ? g.sensitiveMaxMinutes : g.generalMaxMinutes

  if (maxMinutes === null) return { advice, timeEstimate: null }
  if (maxMinutes === 0) return { advice, timeEstimate: null } // "avoid entirely" is already in `advice`
  return { advice, timeEstimate: `roughly ${maxMinutes} minutes or less` }
}
