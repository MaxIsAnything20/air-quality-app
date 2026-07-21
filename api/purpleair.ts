// FLAT file (not a catch-all folder) — same reasoning as api/airnow.ts:
// Vercel's filesystem routing for non-Next.js "Other Frameworks" projects
// only reliably resolves a single path segment per dynamic/catch-all
// bracket file. The vercel.json rewrite for /api/purpleair/:path* forwards
// the sub-path here as the ?upstreamPath= query param instead.
//
// PURPLEAIR_API_KEY lives only here, attached as the X-API-Key header
// PurpleAir's API expects — the browser never sees it, in dev or production.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.PURPLEAIR_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error: 'PURPLEAIR_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.'
    })
    return
  }

  const incoming = new URL(req.url ?? '', 'http://localhost')
  const upstreamPath = incoming.searchParams.get('upstreamPath') || '/'
  incoming.searchParams.delete('upstreamPath')

  try {
    const upstream = await fetch(`https://api.purpleair.com${upstreamPath}${incoming.search}`, {
      headers: { 'X-API-Key': apiKey }
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach PurpleAir.' })
  }
}
