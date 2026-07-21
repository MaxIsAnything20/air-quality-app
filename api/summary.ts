// Backs the AI-generated plain-language summary (README "Next steps" #2),
// including per-region summaries when the person taps a specific AQI
// monitor on the map. ANTHROPIC_API_KEY lives only here — the client
// (src/services/summary.ts) just POSTs the current numbers and gets a
// sentence back. If this endpoint isn't deployed or ANTHROPIC_API_KEY isn't
// set, the client falls back to the local rule-based generator in
// src/hooks/useSummary.ts — same "never just breaks" pattern as the rest
// of the app.
//
// The recommendation itself is grounded in EPA/AirNow's published
// cautionary statements and activity guidance (see
// src/services/aqiGuidance.ts) rather than left for the model to invent —
// we hand it the correct advice/time limit for this category and ask it to
// phrase that into a sentence, not derive it from scratch.
//
// NOTE: the model name below hasn't been exercised against a live account
// from this environment — check it against Anthropic's current model list
// before relying on it, and adjust max_tokens/prompt to taste.
interface SummaryRequestBody {
  aqi: number
  level: string
  forecastPeakAqi: number
  sensitiveGroup: boolean
  stationName?: string | null
  pollutant?: string | null
  pollutantBreakdown?: string | null
  hasForecast?: boolean
  /** 'today' | 'tomorrow' | an ISO past date | null/undefined. Which time
   *  slider step a region reading came from — determines whether the
   *  prompt says "is currently," "is forecast to be," or "was." */
  timeContext?: string | null
}

// Same "duplicated, not imported" reasoning as AQI_GUIDANCE below — this
// file is bundled standalone as a serverless function, kept in sync by
// hand with src/utils/timeSteps.ts.
function describeTimeContext(step: string | null | undefined): { verb: string; whenNote: string; isPastOrFuture: boolean } {
  if (!step || step === 'today') return { verb: 'is currently', whenNote: '', isPastOrFuture: false }
  if (step === 'tomorrow') return { verb: 'is forecast to be', whenNote: " — this is tomorrow's forecast, not a current reading", isPastOrFuture: true }
  const [, month, day] = step.split('-').map(Number)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const label = `${MONTHS[(month ?? 1) - 1]} ${day}`
  return { verb: 'was', whenNote: ` — this was recorded on ${label}, not a current reading`, isPastOrFuture: true }
}

type AqiLevel = 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'veryunhealthy' | 'hazardous'

interface AqiGuidanceEntry {
  generalAdvice: string
  sensitiveAdvice: string
  generalMaxMinutes: number | null
  sensitiveMaxMinutes: number | null
}

// Kept in sync with src/services/aqiGuidance.ts by hand — duplicated here
// rather than imported because this file is bundled standalone as a
// serverless function. If you change one, change the other.
const AQI_GUIDANCE: Record<AqiLevel, AqiGuidanceEntry> = {
  good: { generalAdvice: 'little or no risk, good for any outdoor activity', sensitiveAdvice: '', generalMaxMinutes: null, sensitiveMaxMinutes: null },
  moderate: { generalAdvice: 'acceptable for most people and most outdoor activity', sensitiveAdvice: 'unusually sensitive individuals should take more breaks during prolonged exertion', generalMaxMinutes: null, sensitiveMaxMinutes: 120 },
  sensitive: { generalAdvice: 'fine for most people, watch for symptoms during longer activity', sensitiveAdvice: 'sensitive groups (asthma, heart/lung disease, older adults, children, pregnant people, outdoor workers) should reduce prolonged or heavy outdoor exertion', generalMaxMinutes: null, sensitiveMaxMinutes: 60 },
  unhealthy: { generalAdvice: 'everyone should reduce prolonged or heavy outdoor exertion', sensitiveAdvice: 'sensitive groups should avoid prolonged or heavy outdoor exertion altogether', generalMaxMinutes: 30, sensitiveMaxMinutes: 0 },
  veryunhealthy: { generalAdvice: 'everyone should avoid prolonged or heavy outdoor exertion', sensitiveAdvice: 'sensitive groups should avoid all outdoor physical activity', generalMaxMinutes: 15, sensitiveMaxMinutes: 0 },
  hazardous: { generalAdvice: 'everyone should avoid all outdoor physical activity', sensitiveAdvice: 'sensitive groups should remain indoors', generalMaxMinutes: 0, sensitiveMaxMinutes: 0 }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(501).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' })
    return
  }

  const body: Partial<SummaryRequestBody> =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const { aqi, level, forecastPeakAqi, sensitiveGroup, stationName, pollutant, pollutantBreakdown, hasForecast, timeContext } = body

  if (typeof aqi !== 'number' || typeof forecastPeakAqi !== 'number' || !level) {
    res.status(400).json({ error: 'Expected { aqi, level, forecastPeakAqi, sensitiveGroup } in the request body.' })
    return
  }

  const { verb, whenNote, isPastOrFuture } = describeTimeContext(timeContext)

  const guidance = AQI_GUIDANCE[level as AqiLevel]
  const advice = sensitiveGroup && guidance?.sensitiveAdvice ? guidance.sensitiveAdvice : guidance?.generalAdvice
  const maxMinutes = sensitiveGroup ? guidance?.sensitiveMaxMinutes : guidance?.generalMaxMinutes
  // maxMinutes is an illustrative estimate WE made up, not an EPA figure —
  // EPA's actual Cautionary Statements/Activity Guides are qualitative
  // ("reduce prolonged exertion"), not tied to a clock time. Keep that
  // distinction visible to the model so it doesn't present the estimate
  // as more authoritative than it is.
  const timeGuidance =
    maxMinutes === null || maxMinutes === undefined || maxMinutes === 0
      ? null
      : `a commonly used rule of thumb (not an official EPA figure) is to keep prolonged outdoor exertion to roughly ${maxMinutes} minutes or less`

  const prompt = [
    stationName
      ? `The person tapped a specific AQI monitoring station on the map: "${stationName}"${pollutant ? `, where the primary pollutant is ${pollutant}` : ''}.`
      : '',
    `AQI ${verb} ${aqi} (${level})${whenNote}.`,
    pollutantBreakdown
      ? `Full pollutant breakdown reported at this station: ${pollutantBreakdown}. Mention a secondary pollutant only if it's notably elevated relative to the primary one — don't just list every number.`
      : '',
    hasForecast === false
      ? "No forecast is available for this specific station — don't state or imply one."
      : isPastOrFuture
        ? '' // Forecast peak AQI would be misleading noise next to an already-past or already-forecast reading — omit it.
        : `Forecast peak AQI is ${forecastPeakAqi}.`,
    sensitiveGroup ? 'The person has indicated they are in an AQI-sensitive group.' : '',
    `EPA/AirNow's actual published cautionary guidance for this category: ${advice}.`,
    timeGuidance ? `Separately, ${timeGuidance} — present this as a rough rule of thumb, explicitly NOT as an EPA number, if you mention it at all.` : '',
    isPastOrFuture
      ? `Write two short, plain-language sentences: one describing these conditions using the correct tense (${verb} — do NOT say "currently" or "right now," since this is not a live reading), and one practical recommendation about outdoor activity for this air quality category, based ONLY on the guidance given above.`
      : 'Write two short, plain-language sentences: one summarizing current conditions, and one direct, practical recommendation on whether it is OK to go outside right now, based ONLY on the guidance given above.',
    'Do not state or imply any duration figure came from EPA.',
    'Only use the numbers and guidance given above — do not invent additional figures, locations, or timeframes.'
  ]
    .filter(Boolean)
    .join(' ')

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!upstream.ok) {
      res.status(502).json({ error: `Anthropic API request failed: ${upstream.status}` })
      return
    }

    const data = await upstream.json()
    const text = (data.content ?? [])
      .map((block: { type: string; text?: string }) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join(' ')
      .trim()

    if (!text) {
      res.status(502).json({ error: 'Anthropic API returned no text.' })
      return
    }

    res.status(200).json({ summary: text })
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the Anthropic API.' })
  }
}
