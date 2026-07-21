// Vercel serverless function (deploy target: any provider that runs plain
// Node functions under /api — Vercel auto-detects this path). Mirrors the
// Vite dev middleware in vite.config.ts so the same `/api/airnow/*` calls
// from src/services/airnow.ts work unchanged in dev and in production.
//
// The whole point of this file: AIRNOW_API_KEY lives only in this process's
// environment (set it in your hosting provider's dashboard, NOT prefixed
// with VITE_) and is never sent to or readable by the browser. The client
// only ever talks to this endpoint, never airnowapi.org directly.
//
// Typed loosely (req/res as `any`) to avoid requiring @vercel/node as a
// dependency just for types — add it (`npm i -D @vercel/node`) and swap in
// VercelRequest/VercelResponse if you want stricter typing.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error: 'AIRNOW_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.'
    })
    return
  }

  // req.url on Vercel is everything after the function's own path, e.g.
  // "/aq/observation/latLong/current/?latitude=...&longitude=...". We just
  // forward that straight through to AirNow, adding the key ourselves.
  const incoming = new URL(req.url ?? '', 'http://localhost')
  incoming.searchParams.set('API_KEY', apiKey)

  try {
    const upstream = await fetch(`https://www.airnowapi.org${incoming.pathname}${incoming.search}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach AirNow.' })
  }
}
