import { FieldReport } from '../types'
import { parseFireKml } from './fireKml'

// Always our own same-origin /api/fire path — handled by the Vite dev
// proxy in dev (vite.config.ts) and by api/fire/[...path].ts in
// production. No API key needed for this feed either.
//
// FIX: see src/services/smoke.ts's header comment — this had the same
// dev-only BASE_URL bug, which made production calls go straight to NOAA
// and silently fall back to sample fire data on every real deploy.
const BASE_URL = '/api/fire'

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
