// FLAT file (not a catch-all folder) — Vercel's filesystem routing for
// non-Next.js "Other Frameworks" projects only reliably resolves a single
// path segment per dynamic/catch-all bracket file. Confirmed empirically in
// production: /api/airnow/test worked, /api/airnow/aq/test 404'd even
// though this used to be api/airnow/[...path].ts. Multi-segment upstream
// paths (e.g. aq/observation/latLong/current/) need an explicit
// vercel.json rewrite instead: it captures everything after /api/airnow/
// and forwards it here as the ?upstreamPath= query param, which this
// handler uses to reconstruct the real AirNow request path.
//
// AIRNOW_API_KEY lives only in this process's environment (set it in your
// hosting provider's dashboard, NOT prefixed with VITE_) and is never sent
// to or readable by the browser. The client only ever talks to this
// endpoint, never airnowapi.org directly.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error: 'AIRNOW_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.'
    })
    return
  }

  const incoming = new URL(req.url ?? '', 'http://localhost')
  const upstreamPath = incoming.searchParams.get('upstreamPath') || '/'
  incoming.searchParams.delete('upstreamPath')
  incoming.searchParams.set('API_KEY', apiKey)

  try {
    const upstream = await fetch(`https://www.airnowapi.org${upstreamPath}${incoming.search}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach AirNow.' })
  }
}
