import { ApiNotConfiguredError } from './apiError'

// Always our own `/api/routes` path — see api/routes.ts for why (the
// OPENROUTESERVICE_API_KEY never reaches the client, same reasoning as
// airnow.ts).
const BASE_URL = '/api/routes'

export type RouteProfile = 'foot-walking' | 'cycling-regular'

export interface RouteResult {
  /** [lat, lng] pairs, in path order — note this is the opposite order
   * from ORS's own GeoJSON (which is [lng, lat]); converted once here so
   * every consumer (Leaflet, distance math) can just use [lat, lng]
   * like the rest of this codebase already does. */
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

// ⚠️ Parses OpenRouteService's real GeoJSON directions response shape
// (features[0].geometry.coordinates as [lng,lat][], features[0].properties
// .summary.{distance,duration}) per ORS's published API docs — written
// without a live key to test against, since none was available at the
// time this was built. If OPENROUTESERVICE_API_KEY is set and this
// throws or returns nothing usable, that response shape is the first
// thing to double-check against https://openrouteservice.org/dev/#/api-docs.
export async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  profile: RouteProfile = 'foot-walking'
): Promise<RouteResult> {
  const params = new URLSearchParams({
    profile,
    start: `${start.lng},${start.lat}`,
    end: `${end.lng},${end.lat}`
  })

  const res = await fetch(`${BASE_URL}?${params}`)

  if (res.status === 501) {
    const body = await res.json().catch(() => null)
    throw new ApiNotConfiguredError(body?.error ?? 'OpenRouteService API key is not configured on the server.')
  }
  if (!res.ok) {
    throw new Error(`Route request failed: ${res.status}`)
  }

  const data = await res.json()
  const feature = data?.features?.[0]
  if (!feature?.geometry?.coordinates?.length) {
    throw new Error('OpenRouteService returned no usable route.')
  }

  const coordinates: [number, number][] = feature.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  )
  const summary = feature.properties?.summary ?? { distance: 0, duration: 0 }

  return {
    coordinates,
    distanceMeters: summary.distance ?? 0,
    durationSeconds: summary.duration ?? 0
  }
}
