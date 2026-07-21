import { SmokePolygon } from '../types'
import { parseSmokeKml } from './smokeKml'

// Always our own same-origin /api/smoke path — handled by the Vite dev
// proxy in dev (vite.config.ts) and by api/smoke/[...path].ts in
// production. No API key needed for this feed, unlike AirNow.
//
// FIX: this used to be `import.meta.env.DEV ? '/api/smoke' : 'https://www.ospo.noaa.gov'`,
// which made the *production* build call NOAA directly from the browser —
// bypassing the api/smoke proxy entirely and defeating the CORS-avoidance
// it exists for (see api/smoke.ts's own header comment). In practice this
// meant the smoke layer would silently fall back to sample data on every
// real deploy. Always route through our own API path instead.
const BASE_URL = '/api/smoke'

export async function fetchSmokePolygons(): Promise<SmokePolygon[]> {
  const res = await fetch(`${BASE_URL}/data/land/fire/smoke.kml`)
  if (!res.ok) {
    throw new Error(`NOAA smoke feed request failed: ${res.status}`)
  }
  const text = await res.text()
  // An empty result is a valid "no smoke today" answer, not a parse failure.
  return parseSmokeKml(text)
}
