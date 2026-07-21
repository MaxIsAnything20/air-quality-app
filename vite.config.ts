import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev stand-in for the /api/airnow.ts and /api/purpleair.ts serverless
// functions (see the api/ directory). Both keep their API key entirely
// server-side: this plugin reads AIRNOW_API_KEY / PURPLEAIR_API_KEY from the
// environment (loaded from .env below with no VITE_ prefix, so Vite never
// inlines them into the client bundle) and attaches them itself, instead of
// just forwarding whatever the client sent — which is what the old bare
// proxy did, and why the keys used to have to ship as VITE_-prefixed vars.
function apiKeyProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'api-key-proxy',
    configureServer(server) {
      server.middlewares.use('/api/airnow', async (req, res) => {
        const key = env.AIRNOW_API_KEY
        if (!key) {
          res.statusCode = 501
          res.setHeader('content-type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Set AIRNOW_API_KEY in .env (no VITE_ prefix) to enable this in dev.'
            })
          )
          return
        }
        const incoming = new URL(req.url ?? '', 'http://localhost')
        incoming.searchParams.set('API_KEY', key)
        try {
          const upstream = await fetch(`https://www.airnowapi.org${incoming.pathname}${incoming.search}`)
          res.statusCode = upstream.status
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
          res.end(await upstream.text())
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not reach AirNow.' }))
        }
      })

      server.middlewares.use('/api/purpleair', async (req, res) => {
        const key = env.PURPLEAIR_API_KEY
        if (!key) {
          res.statusCode = 501
          res.setHeader('content-type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'Set PURPLEAIR_API_KEY in .env (no VITE_ prefix) to enable this in dev.'
            })
          )
          return
        }
        try {
          const upstream = await fetch(`https://api.purpleair.com${req.url ?? ''}`, {
            headers: { 'X-API-Key': key }
          })
          res.statusCode = upstream.status
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
          res.end(await upstream.text())
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Could not reach PurpleAir.' }))
        }
      })

      // Deliberately NOT sharing code with api/summary.ts via import: that
      // file is picked up by Vercel's build as an isolated serverless
      // function, and importing it here would ask Node to parse TS at dev-
      // server runtime with no transpile step. Short enough to duplicate;
      // keep the two in sync if you change the prompt, guidance table, or
      // model — see src/services/aqiGuidance.ts for the canonical table.
      server.middlewares.use('/api/summary', async (req, res) => {
        const key = env.ANTHROPIC_API_KEY
        if (!key) {
          res.statusCode = 501
          res.setHeader('content-type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'ANTHROPIC_API_KEY is not set — the app falls back to the local rule-based summary.'
            })
          )
          return
        }

        let raw = ''
        req.on('data', (chunk) => (raw += chunk))
        req.on('end', async () => {
          try {
            const { aqi, level, forecastPeakAqi, sensitiveGroup, stationName, pollutant, pollutantBreakdown, hasForecast, timeContext } = JSON.parse(raw || '{}')
            if (typeof aqi !== 'number' || typeof forecastPeakAqi !== 'number' || !level) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Expected { aqi, level, forecastPeakAqi, sensitiveGroup }.' }))
              return
            }

            // Same "duplicated, not imported" reasoning as AQI_GUIDANCE
            // below — kept in sync by hand with src/utils/timeSteps.ts.
            function describeTimeContext(step: string | null | undefined) {
              if (!step || step === 'today') return { verb: 'is currently', whenNote: '', isPastOrFuture: false }
              if (step === 'tomorrow') return { verb: 'is forecast to be', whenNote: " — this is tomorrow's forecast, not a current reading", isPastOrFuture: true }
              const [, month, day] = step.split('-').map(Number)
              const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const label = `${MONTHS[(month ?? 1) - 1]} ${day}`
              return { verb: 'was', whenNote: ` — this was recorded on ${label}, not a current reading`, isPastOrFuture: true }
            }
            const { verb, whenNote, isPastOrFuture } = describeTimeContext(timeContext)

            const AQI_GUIDANCE: Record<string, { generalAdvice: string; sensitiveAdvice: string; generalMaxMinutes: number | null; sensitiveMaxMinutes: number | null }> = {
              good: { generalAdvice: 'little or no risk, good for any outdoor activity', sensitiveAdvice: '', generalMaxMinutes: null, sensitiveMaxMinutes: null },
              moderate: { generalAdvice: 'acceptable for most people and most outdoor activity', sensitiveAdvice: 'unusually sensitive individuals should take more breaks during prolonged exertion', generalMaxMinutes: null, sensitiveMaxMinutes: 120 },
              sensitive: { generalAdvice: 'fine for most people, watch for symptoms during longer activity', sensitiveAdvice: 'sensitive groups (asthma, heart/lung disease, older adults, children, pregnant people, outdoor workers) should reduce prolonged or heavy outdoor exertion', generalMaxMinutes: null, sensitiveMaxMinutes: 60 },
              unhealthy: { generalAdvice: 'everyone should reduce prolonged or heavy outdoor exertion', sensitiveAdvice: 'sensitive groups should avoid prolonged or heavy outdoor exertion altogether', generalMaxMinutes: 30, sensitiveMaxMinutes: 0 },
              veryunhealthy: { generalAdvice: 'everyone should avoid prolonged or heavy outdoor exertion', sensitiveAdvice: 'sensitive groups should avoid all outdoor physical activity', generalMaxMinutes: 15, sensitiveMaxMinutes: 0 },
              hazardous: { generalAdvice: 'everyone should avoid all outdoor physical activity', sensitiveAdvice: 'sensitive groups should remain indoors', generalMaxMinutes: 0, sensitiveMaxMinutes: 0 }
            }

            const guidance = AQI_GUIDANCE[level]
            const advice = sensitiveGroup && guidance?.sensitiveAdvice ? guidance.sensitiveAdvice : guidance?.generalAdvice
            const maxMinutes = sensitiveGroup ? guidance?.sensitiveMaxMinutes : guidance?.generalMaxMinutes
            // maxMinutes is an illustrative estimate WE made up, not an EPA
            // figure — see src/services/aqiGuidance.ts's file header.
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
                  ? '' // Would be misleading noise next to an already-past or already-forecast reading — omit it.
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

            const upstream = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages: [{ role: 'user', content: prompt }]
              })
            })

            if (!upstream.ok) {
              res.statusCode = 502
              res.end(JSON.stringify({ error: `Anthropic API request failed: ${upstream.status}` }))
              return
            }

            const data = await upstream.json()
            const text = (data.content ?? [])
              .map((block: { type: string; text?: string }) => (block.type === 'text' ? block.text : ''))
              .filter(Boolean)
              .join(' ')
              .trim()

            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ summary: text || null }))
          } catch {
            res.statusCode = 502
            res.end(JSON.stringify({ error: 'Could not reach the Anthropic API.' }))
          }
        })
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  // Third argument '' (instead of the default 'VITE_') loads every var in
  // .env, not just VITE_-prefixed ones — that's the whole point here: these
  // keys must NOT be VITE_-prefixed, or Vite would inline them client-side.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), apiKeyProxyPlugin(env)],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api/smoke': {
          target: 'https://www.ospo.noaa.gov',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/smoke/, '')
        },
        '/api/fire': {
          target: 'https://www.ospo.noaa.gov',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fire/, '')
        }
      }
    }
  }
})
