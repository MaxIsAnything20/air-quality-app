import { FieldReport } from '../types'
import { parseFireKml } from './fireKml'

// Same reasoning as smoke.ts: in dev, requests go through the Vite proxy at
// /api/fire (see vite.config.ts) so the browser doesn't hit ospo.noaa.gov's
// CORS policy directly. No API key needed for this feed either.
const BASE_URL = import.meta.env.DEV ? '/api/fire' : 'https://www.ospo.noaa.gov'

export async function fetchFireReports(near: {
  lat: number
  lng: number
}): Promise<FieldReport[]> {
  const res = await fetch(`${BASE_URL}/data/land/fire/fire.kml`)
  if (!res.ok) {
    throw new Error(`NOAA fire feed request failed: ${res.status}`)
  }
  const text = await res.text()
  // An empty result is a valid "no active fires nearby" answer, not a parse failure.
  return parseFireKml(text, { near, radiusKm: 300 })
}
