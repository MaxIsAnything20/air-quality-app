// RENAMED from api/airnow.ts -> api/airnow/[...path].ts.
//
// Why: src/services/airnow.ts calls this proxy at *sub-paths*, e.g.
// /api/airnow/aq/observation/latLong/current/?... — not just /api/airnow
// itself. Vercel's file-system routing only maps api/airnow.ts to the
// exact path /api/airnow; a request to any sub-path 404s unless the
// function is declared as a catch-all. Renaming the file to use Vercel's
// [...path] dynamic-segment convention makes it match every sub-path.
//
// IMPORTANT DIFFERENCE FROM THE ORIGINAL FILE: in dev, vite.config.ts's
// middleware is mounted with server.middlewares.use('/api/airnow', ...),
// which strips that prefix from req.url automatically (connect/Node
// middleware convention) — so the old handler could use req.url's pathname
// directly as the AirNow path. Vercel does NOT strip the prefix: req.url
// here is the full original request path, e.g.
// "/api/airnow/aq/observation/latLong/current/?...". This version strips
// the "/api/airnow" prefix itself before forwarding — that line is the
// actual fix; everything else is unchanged from the original.
//
// The whole point of this file: AIRNOW_API_KEY lives only in this process's
// environment (set it in your hosting provider's dashboard, NOT prefixed
// with VITE_) and is never sent to or readable by the browser. The client
// only ever talks to this endpoint, never airnowapi.org directly.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error: 'AIRNOW_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.'
    })
    return
  }

  const incoming = new URL(req.url ?? '', 'http://localhost')
  const upstreamPath = incoming.pathname.replace(/^\/api\/airnow/, '') || '/'
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
