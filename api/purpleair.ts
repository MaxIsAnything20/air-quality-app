// Same reasoning as api/airnow.ts. PURPLEAIR_API_KEY lives only here,
// attached as the X-API-Key header PurpleAir's API expects — the browser
// never sees it, in dev or production.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.PURPLEAIR_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error: 'PURPLEAIR_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.'
    })
    return
  }

  try {
    const upstream = await fetch(`https://api.purpleair.com${req.url ?? ''}`, {
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
