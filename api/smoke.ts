// FLAT file (not a catch-all folder) — same reasoning as api/airnow.ts.
// The vercel.json rewrite for /api/smoke/:path* forwards the sub-path here
// as the ?upstreamPath= query param instead of relying on filesystem
// catch-all matching, which only reliably resolves one path segment for
// non-Next.js "Other Frameworks" projects.
//
// No API key involved — this exists purely so the production domain has
// the same same-origin `/api/smoke` path the Vite dev proxy provides,
// sidestepping ospo.noaa.gov's CORS policy on the real deploy too.
export default async function handler(req: any, res: any) {
  const incoming = new URL(req.url ?? '', 'http://localhost')
  const upstreamPath = incoming.searchParams.get('upstreamPath') || '/'
  incoming.searchParams.delete('upstreamPath')

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
