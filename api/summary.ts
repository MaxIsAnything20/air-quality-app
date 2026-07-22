// Backs the AI-generated plain-language summary (README "Next steps" #2),
// including per-region summaries when the person taps a specific AQI
// monitor on the map. GEMINI_API_KEY lives only here — the client
// (src/services/summary.ts) just POSTs the current numbers and gets a
// sentence back. If this endpoint isn't deployed or GEMINI_API_KEY isn't
// set, the client falls back to the local rule-based generator in
// src/hooks/useSummary.ts — same "never just breaks" pattern as the rest
// of the app.
//
// Also backs the per-activity "AirCoach" insight (src/services/activityInsight.ts)
// via the same endpoint, gated on `mode: 'activity'` in the request body —
// reuses the same Gemini call/API key/free-tier budget rather than adding
// a second serverless function, since Vercel's Hobby plan caps functions
// per deployment. If that request fails for any reason, the client falls
// back to the deterministic src/services/activityFeedback.ts sentence,
// which is always shown regardless — the AI insight is a bonus on top,
// never the only feedback shown for an activity.
//
// The recommendation itself is grounded in EPA/AirNow's published
// cautionary statements and activity guidance (see
// src/services/aqiGuidance.ts) rather than left for the model to invent —
// we hand it the correct advice/time limit for this category and ask it to
// phrase that into a sentence, not derive it from scratch.
//
// NOTE: uses Google's Gemini API free tier via the generateContent REST
// endpoint — 1,500 requests/day, no billing account needed, as of when
// this was written. Uses the `gemini-flash-latest` alias (Google's
// documented stable pointer to whatever the current default Flash model
// is) rather than pinning a dated model string like `gemini-2.5-flash`,
// since that pinned name 404'd in testing — likely because it had already
// been superseded. `gemini-flash-latest` gets hot-swapped by Google with
// 2 weeks' notice on breaking changes, so it shouldn't need manual upkeep
// the way a pinned version does. See
// https://ai.google.dev/gemini-api/docs/models for details if this ever
// needs revisiting.
//
// thinkingConfig.thinkingBudget: 0 turns off "thinking" mode, which is on
// by default for 2.5/3.x Flash models. Without this, the model spends its
// maxOutputTokens budget on internal reasoning tokens before it ever
// writes the actual sentence, which truncated/garbled real responses in
// testing — this is a short, low-stakes summary task with no need for
// extended reasoning.
interface SummaryRequestBody {
  mode?: 'conditions' | 'activity'
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
  // --- activity-mode fields (mode: 'activity') ---
  activityType?: string
  avgAqi?: number | null
  avgLevel?: string | null
  peakAqi?: number | null
  distanceKm?: number
  durationMinutes?: number
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

/** Shared Gemini call for both conditions-mode and activity-mode prompts —
 *  same model, same generation config, same response-shape handling.
 *  Throws with a descriptive message on any failure; callers translate
 *  that into the appropriate HTTP status. */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } }
      })
    }
  )

  if (!upstream.ok) {
    throw new Error(`Gemini API request failed: ${upstream.status}`)
  }

  const data = await upstream.json()
  const text = (data.candidates ?? [])
    .flatMap((c: { content?: { parts?: { text?: string }[] } }) => c.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? '')
    .filter(Boolean)
    .join(' ')
    .trim()

  if (!text) {
    throw new Error('Gemini API returned no text.')
  }
  return text
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(501).json({ error: 'GEMINI_API_KEY is not set on the server.' })
    return
  }

  const body: Partial<SummaryRequestBody> =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}

  if (body.mode === 'activity') {
    const { activityType, avgAqi, avgLevel, peakAqi, distanceKm, durationMinutes } = body

    if (typeof durationMinutes !== 'number') {
      res.status(400).json({ error: 'Expected { mode: "activity", durationMinutes, ... } in the request body.' })
      return
    }

    const guidance = avgLevel ? AQI_GUIDANCE[avgLevel as AqiLevel] : null
    const distancePart =
      typeof distanceKm === 'number' && distanceKm >= 0.1 ? `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km` : null
    const durationPart = `${Math.round(durationMinutes)} minutes`

    const prompt = [
      `The person just finished a logged "${activityType ?? 'outdoor'}" activity lasting ${durationPart}${distancePart ? ` over ${distancePart}` : ''}.`,
      typeof avgAqi === 'number'
        ? `Their average air quality exposure during the activity was ${avgAqi} AQI (${avgLevel}).`
        : 'No air quality readings were available along their route, so exposure could not be estimated.',
      typeof peakAqi === 'number' && peakAqi !== avgAqi ? `The worst moment along the route reached ${peakAqi} AQI.` : '',
      guidance ? `EPA/AirNow's actual published cautionary guidance for this category: ${guidance.generalAdvice}.` : '',
      'Write two short, plain-language, encouraging AirCoach-style sentences: one reflecting on how this specific activity went from an air-quality standpoint, and one practical, forward-looking tip for their next similar session, based ONLY on the guidance and numbers given above.',
      'Do not invent additional figures, locations, or timeframes. Do not state or imply any duration figure came from EPA.'
    ]
      .filter(Boolean)
      .join(' ')

    try {
      const text = await callGemini(prompt, apiKey)
      res.status(200).json({ summary: text })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach the Gemini API.' })
    }
    return
  }

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
    const text = await callGemini(prompt, apiKey)
    res.status(200).json({ summary: text })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach the Gemini API.' })
  }
}
