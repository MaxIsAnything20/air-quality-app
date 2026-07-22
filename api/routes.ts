// Mirrors api/airnow.ts's proxy pattern exactly: the OpenRouteService key
// lives only in this process's environment (OPENROUTESERVICE_API_KEY, set
// in your hosting provider's dashboard — NOT prefixed with VITE_) and is
// never sent to or readable by the browser. The client only ever talks to
// this endpoint, never api.openrouteservice.org directly.
//
// Until OPENROUTESERVICE_API_KEY is set, this returns 501 and the client
// (see src/hooks/useRoutePlanning.ts) falls back to a clearly-labeled
// sample straight-line route instead of pretending to have real
// turn-by-turn directions.
export default async function handler(req: any, res: any) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) {
    res.status(501).json({
      error:
        "OPENROUTESERVICE_API_KEY is not set on the server. Add it in your hosting provider's environment variables to enable real route planning."
    })
    return
  }

  const incoming = new URL(req.url ?? '', 'http://localhost')
  const profile = incoming.searchParams.get('profile') || 'foot-walking'
  const start = incoming.searchParams.get('start')
  const end = incoming.searchParams.get('end')

  if (!start || !end) {
    res.status(400).json({ error: 'Expected "start" and "end" query params as "lng,lat".' })
    return
  }

  try {
    const upstream = await fetch(
      `https://api.openrouteservice.org/v2/directions/${encodeURIComponent(profile)}` +
        `?api_key=${apiKey}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    )
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(body)
  } catch {
    res.status(502).json({ error: 'Could not reach OpenRouteService.' })
  }
}
