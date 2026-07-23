import { RouteNotPossibleError } from './apiError'

// Always our own `/api/routes` path — the proxy forwards to OSRM's free,
// open-source public demo server (router.project-osrm.org, sponsored by
// FOSSGIS). No API key is needed at all for this service, so unlike some
// of this app's other proxies there's nothing secret to keep off the
// client — the indirection just keeps the OSRM host/URL shape in one
// place (see api/routes.ts).
const BASE_URL = '/api/routes'

export type RouteProfile = 'foot-walking' | 'cycling-regular'

// Human-facing maneuver vocabulary this app understands — see
// src/services/navigationInstructions.ts for how these map to spoken/
// written instructions and icons. Kept as the union OSRM actually sends
// (https://project-osrm.org/docs/v5.24.0/api/#stepmaneuver-object) rather
// than a narrower app-specific set, so nothing gets silently dropped.
export type ManeuverType =
  | 'turn'
  | 'new name'
  | 'depart'
  | 'arrive'
  | 'merge'
  | 'on ramp'
  | 'off ramp'
  | 'fork'
  | 'end of road'
  | 'use lane'
  | 'continue'
  | 'roundabout'
  | 'rotary'
  | 'roundabout turn'
  | 'notification'
  | 'exit roundabout'
  | 'exit rotary'

export type ManeuverModifier =
  | 'uturn'
  | 'sharp right'
  | 'right'
  | 'slight right'
  | 'straight'
  | 'slight left'
  | 'left'
  | 'sharp left'

export interface NavigationStep {
  /** [lat, lng] of this step's maneuver point — same [lat, lng] convention
   * as RouteResult.coordinates, converted from OSRM's [lng, lat]. */
  location: [number, number]
  distanceMeters: number
  durationSeconds: number
  /** Real OSM way name for this step, when OSM has one — often blank for
   * unnamed footpaths/trails, never invented when missing. */
  streetName: string
  maneuverType: ManeuverType
  maneuverModifier: ManeuverModifier | null
}

export interface RouteResult {
  /** [lat, lng] pairs, in path order — note this is the opposite order
   * from OSRM's own GeoJSON (which is [lng, lat]); converted once here so
   * every consumer (Leaflet, distance math) can just use [lat, lng]
   * like the rest of this codebase already does. */
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
  /** Real turn-by-turn maneuvers from OSRM (steps: 'true' — see
   * api/routes.ts), in path order. Empty when OSRM's response has no leg
   * steps for some reason — callers should treat that as "no navigation
   * available" rather than assuming it's always populated. */
  steps: NavigationStep[]
}

function parseSteps(route: any): NavigationStep[] {
  const legSteps = route.legs?.[0]?.steps ?? []
  return legSteps.map((step: any) => {
    const loc = step.maneuver?.location
    return {
      location: (loc ? [loc[1], loc[0]] : [0, 0]) as [number, number],
      distanceMeters: step.distance ?? 0,
      durationSeconds: step.duration ?? 0,
      streetName: step.name || '',
      maneuverType: (step.maneuver?.type ?? 'turn') as ManeuverType,
      maneuverModifier: (step.maneuver?.modifier ?? null) as ManeuverModifier | null
    }
  })
}

function parseRoute(route: any): RouteResult {
  const coordinates: [number, number][] = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => [lat, lng]
  )
  return {
    coordinates,
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
    steps: parseSteps(route)
  }
}

async function requestDirections(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  profile: RouteProfile,
  alternatives: boolean
) {
  const params = new URLSearchParams({
    profile,
    start: `${start.lng},${start.lat}`,
    end: `${end.lng},${end.lat}`
  })
  if (alternatives) params.set('alternatives', 'true')

  const res = await fetch(`${BASE_URL}?${params}`)

  if (res.status === 400) {
    // Our proxy (api/routes.ts) only returns 400 when OSRM itself
    // responded with `code !== "Ok"` — i.e. it understood the request
    // but genuinely couldn't find a route between these two points
    // (island, no connecting road/trail for this profile, etc).
    throw new RouteNotPossibleError(
      'No route exists between these two points for this activity — they may not be connected by any road or trail.'
    )
  }
  if (!res.ok) {
    throw new Error(`Route request failed: ${res.status}`)
  }

  const data = await res.json()
  const routes = data?.routes ?? []
  if (!routes.length) {
    throw new RouteNotPossibleError('No route exists between these two points for this activity.')
  }
  return routes
}

/** Parses OSRM's real route response shape (routes[0].geometry.coordinates
 * as [lng,lat][], routes[0].{distance,duration} directly on the route
 * object, routes[0].legs[0].steps for turn-by-turn) per the OSRM HTTP API
 * docs — verified against the live public demo server
 * (router.project-osrm.org) before this was written. */
export async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  profile: RouteProfile = 'foot-walking'
): Promise<RouteResult> {
  const routes = await requestDirections(start, end, profile, false)
  return parseRoute(routes[0])
}

/** Same as fetchRoute, but asks OSRM for up to 3 alternative paths (see
 * api/routes.ts) instead of just the single best one — this is what backs
 * the "cleanest / shortest / balanced" route comparison in
 * RoutePlanningView.tsx. OSRM doesn't guarantee 3 back; short or
 * heavily-constrained trips often only get 1 or 2, and this simply
 * returns however many it provides rather than padding the list with
 * duplicates. */
export async function fetchRoutes(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  profile: RouteProfile = 'foot-walking'
): Promise<RouteResult[]> {
  const routes = await requestDirections(start, end, profile, true)
  return routes.map(parseRoute)
}
