// FLAT file (not a catch-all folder) — same reasoning as api/airnow.ts.
// The vercel.json rewrite for /api/fire/:path* forwards the sub-path here
// as the ?upstreamPath= query param instead of relying on filesystem
// catch-all matching, which only reliably resolves one path segment for
// non-Next.js "Other Frameworks" projects.
export default async function handler(req: any, res: any) {
  const incoming = new URL(req.url ?? '', 'http://localhost')
const rawPath = incoming.searchParams.get('upstreamPath') || ''
  const upstreamPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  incoming.searchParams.delete('upstreamPath')

  try {
    const upstream = await fetch(`https://www.ospo.noaa.gov${upstreamPath}${incoming.search}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/vnd.google-earth.kml+xml')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach NOAA fire feed.' })
  }
}
