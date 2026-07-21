// Same reasoning as api/smoke.ts — same feed family, no key needed.
export default async function handler(req: any, res: any) {
  try {
    const upstream = await fetch(`https://www.ospo.noaa.gov${req.url ?? ''}`)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/vnd.google-earth.kml+xml')
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Could not reach NOAA fire feed.' })
  }
}
