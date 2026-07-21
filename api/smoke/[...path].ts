// RENAMED from api/smoke.ts -> api/smoke/[...path].ts.
// Now actually reachable from production: src/services/smoke.ts was
// calling NOAA directly in production (see that file's own fix comment)
// instead of this proxy, and even once fixed to call /api/smoke/data/...,
// a plain api/smoke.ts would 404 on that sub-path the same way
// api/airnow.ts did. This catch-all fixes both halves of that gap.
//
// No API key involved — this exists purely so the production domain has
// the same same-origin `/api/smoke` path the Vite dev proxy provides,
// sidestepping ospo.noaa.gov's CORS policy on your real deploy too.
export default async function handler(req: any, res: any) {
  const incoming = new URL(req.url ?? '', 'http://localhost')
  const upstreamPath = incoming.pathname.replace(/^\/api\/smoke/, '') || '/'

  try {
    const upstream = await fetch(`https://www.ospo.noaa.gov${upstreamPath}${incoming.search}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/vnd.google-earth.kml+xml')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach NOAA smoke feed.' })
  }
}
