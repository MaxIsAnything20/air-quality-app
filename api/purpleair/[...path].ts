// RENAMED from api/purpleair.ts -> api/purpleair/[...path].ts.
// Same reasoning as api/airnow/[...path].ts: src/services/purpleair.ts
// calls this at /api/purpleair/v1/sensors?..., a sub-path Vercel's
// file-system routing would 404 on with a plain api/purpleair.ts.
//
// Same fix as airnow: req.url here is the full path including the
// "/api/purpleair" prefix (unlike the dev middleware, which strips it),
// so that prefix is stripped explicitly before forwarding.
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
  const upstreamPath = incoming.pathname.replace(/^\/api\/purpleair/, '') || '/'

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
