import { SmokePolygon } from '../types'
import { parseSmokeKml } from './smokeKml'

// Same reasoning as airnow.ts: in dev, requests go through the Vite proxy at
// /api/smoke (see vite.config.ts) so the browser doesn't hit ospo.noaa.gov's
// CORS policy directly. No API key needed for this feed, unlike AirNow.
const BASE_URL = import.meta.env.DEV ? '/api/smoke' : 'https://www.ospo.noaa.gov'

export async function fetchSmokePolygons(): Promise<SmokePolygon[]> {
  const res = await fetch(`${BASE_URL}/data/land/fire/smoke.kml`)
  if (!res.ok) {
    throw new Error(`NOAA smoke feed request failed: ${res.status}`)
  }
  const text = await res.text()
  // An empty result is a valid "no smoke today" answer, not a parse failure.
  return parseSmokeKml(text)
}
