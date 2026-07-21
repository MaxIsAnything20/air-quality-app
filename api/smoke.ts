// No API key involved — this exists purely so the production domain has
// the same same-origin `/api/smoke` path the Vite dev proxy provides,
// sidestepping ospo.noaa.gov's CORS policy on your real deploy too.
export default async function handler(req: any, res: any) {
  try {
    const upstream = await fetch(`https://www.ospo.noaa.gov${req.url ?? ''}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/vnd.google-earth.kml+xml')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach NOAA smoke feed.' })
  }
}
