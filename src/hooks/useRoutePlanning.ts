import { useCallback, useMemo, useState } from 'react'
import type { AqiReading } from '../types'
import { ApiNotConfiguredError, RouteNotPossibleError } from '../services/apiError'
import { fetchRoutes, RouteProfile, RouteResult } from '../services/routes'
import {
  FREE_ROUTE_PLAN_LIMIT,
  getRoutePlanCount,
  hasFreeRoutePlansRemaining,
  incrementRoutePlanCount,
} from '../services/routePlans'
import {
  averageAqiAlongRoute,
  buildRouteAqiSegments,
  distanceMeters,
  findWorstRouteStretch,
  nearestAqiReading,
  RouteAqiSegment,
  WorstRouteStretch,
} from '../services/routeAir'

export interface LatLng {
  lat: number
  lng: number
}

export type RouteOptionLabel = 'Cleanest' | 'Shortest' | 'Balanced' | 'Best'

export interface RoutePlan {
  route: RouteResult
  usingSampleData: boolean
  originAqi: number | null
  destinationAqi: number | null
  routeAvgAqi: number | null
  // Both null for the sample placeholder route — its straight-line shape
  // isn't real, so tracing "AQI along the path" would be tracing a path
  // that doesn't exist. Only populated once a real OpenRouteService
  // geometry comes back. See services/routeAir.ts.
  routeSegments: RouteAqiSegment[] | null
  worstStretch: WorstRouteStretch | null
  // Only set when more than one real route came back from OpenRouteService
  // — see labelRouteOptions below. Undefined for the single-route/sample
  // case, where a label would be meaningless.
  label?: RouteOptionLabel
}

// Commonly used rough pace estimates (not measured, not personalized) —
// only used to give the sample/placeholder route an honest, clearly
// approximate duration instead of leaving it blank. Real routes get their
// duration straight from OpenRouteService instead of this.
const AVERAGE_WALK_SPEED_MPS = 1.4 // ~5 km/h
const AVERAGE_CYCLE_SPEED_MPS = 4.2 // ~15 km/h

// A straight-line sanity ceiling per activity — not a claim about an exact
// physical limit, just a practical "is this even a single-trip distance"
// gate so a request between, say, New York and Los Angeles doesn't
// silently come back as a 300-hour walking "route." Checked before ever
// calling the routing API, so it applies the same whether or not
// OPENROUTESERVICE_API_KEY is configured server-side.
const MAX_REALISTIC_DISTANCE_METERS: Record<RouteProfile, number> = {
  'foot-walking': 50_000, // ~31 mi — beyond a realistic single walk
  'cycling-regular': 250_000 // ~155 mi — beyond a realistic single ride
}
const METERS_PER_MILE = 1609.34

// A clearly-labeled placeholder route (straight line between the two real
// points, with an honest estimated duration from a commonly-used average
// pace) shown only when OPENROUTESERVICE_API_KEY isn't set server-side —
// see api/routes.ts. Never presented as real turn-by-turn directions;
// RoutePlanningView.tsx always shows a "sample route" banner alongside it,
// and this app deliberately does NOT compute an "AQI along the route" for
// it (see planRoute below) since that path shape isn't real. Sample mode
// only ever produces one route — there's no meaningful "alternative"
// straight line between two fixed points.
function buildSampleRoute(start: LatLng, end: LatLng, profile: RouteProfile): RouteResult {
  const steps = 6
  const coordinates: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    coordinates.push([start.lat + (end.lat - start.lat) * t, start.lng + (end.lng - start.lng) * t])
  }
  const straightLineMeters = distanceMeters(start, end)
  const speed = profile === 'cycling-regular' ? AVERAGE_CYCLE_SPEED_MPS : AVERAGE_WALK_SPEED_MPS
  return {
    coordinates,
    distanceMeters: straightLineMeters,
    durationSeconds: straightLineMeters / speed
  }
}

// Tags each real route option with which trade-off it represents —
// mirrors AirTrack's "cleanest / balanced / shortest" route comparison.
// Only called for real (non-sample) route sets; ties are broken by
// whichever route ORS listed first. If the same route wins on both AQI
// and distance, it's labeled "Best" instead of being double-labeled, and
// any remaining route(s) are labeled "Balanced" as a middle option.
function labelRouteOptions(plans: RoutePlan[]): RoutePlan[] {
  if (plans.length <= 1) return plans

  let cleanestIndex = 0
  let shortestIndex = 0
  plans.forEach((plan, index) => {
    const currentAqi = plans[cleanestIndex].routeAvgAqi
    if (plan.routeAvgAqi != null && (currentAqi == null || plan.routeAvgAqi < currentAqi)) {
      cleanestIndex = index
    }
    if (plan.route.distanceMeters < plans[shortestIndex].route.distanceMeters) {
      shortestIndex = index
    }
  })

  return plans.map((plan, index) => {
    if (cleanestIndex === shortestIndex && index === cleanestIndex) {
      return { ...plan, label: 'Best' as const }
    }
    if (index === cleanestIndex) return { ...plan, label: 'Cleanest' as const }
    if (index === shortestIndex) return { ...plan, label: 'Shortest' as const }
    return { ...plan, label: 'Balanced' as const }
  })
}

function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Location access was denied. Enable it in your browser settings to plan a route.')),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

/**
 * Drives the route-planning screen with an explicit Start and End —
 * mirroring how a real navigation app separates "where from" and "where
 * to" — rather than silently assuming the current GPS fix is always the
 * start. Start can be set two ways: a real device geolocation fix (see
 * useCurrentLocationAsOrigin) or a real place search (same search used
 * for the destination). Nothing is planned until both ends are set and
 * the person explicitly asks for routes.
 *
 * Once both ends are set, planRoute first runs a cheap straight-line
 * feasibility check (MAX_REALISTIC_DISTANCE_METERS) before ever calling
 * the routing API — catching "that's not a realistic single trip"
 * requests immediately. It then requests up to 3 real route alternatives
 * from OpenRouteService (see services/routes.ts's fetchRoutes), falling
 * back to a single clearly-labeled sample straight-line route when
 * OPENROUTESERVICE_API_KEY isn't configured — never silently pretending a
 * placeholder is a real route. If OpenRouteService itself reports the two
 * points genuinely aren't connected by any road/trail, that's surfaced as
 * the same 'infeasible' status as the distance check, distinct from a
 * generic technical error. AQI figures (average, per-segment, worst
 * stretch — see services/routeAir.ts) are always real, pulled from
 * whatever aqiReadings the caller passes in, computed separately for each
 * route option, and only computed for real route geometry.
 */
export function useRoutePlanning(aqiReadings: AqiReading[]) {
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [originLabel, setOriginLabel] = useState<string | null>(null)
  const [locatingOrigin, setLocatingOrigin] = useState(false)

  const [destination, setDestination] = useState<(LatLng & { label: string }) | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'infeasible'>('idle')
  const [routeOptions, setRouteOptions] = useState<RoutePlan[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infeasibleReason, setInfeasibleReason] = useState<string | null>(null)
  const [planCount, setPlanCount] = useState(() => getRoutePlanCount())

  const useCurrentLocationAsOrigin = useCallback(async () => {
    setLocatingOrigin(true)
    setErrorMessage(null)
    try {
      const point = await getCurrentPosition()
      setOrigin(point)
      setOriginLabel('Current location')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not get your location.')
    } finally {
      setLocatingOrigin(false)
    }
  }, [])

  const setOriginPlace = useCallback((place: LatLng & { label: string }) => {
    setOrigin({ lat: place.lat, lng: place.lng })
    setOriginLabel(place.label)
  }, [])

  const clearOrigin = useCallback(() => {
    setOrigin(null)
    setOriginLabel(null)
  }, [])

  const setDestinationPlace = useCallback((place: LatLng & { label: string }) => {
    setDestination(place)
  }, [])

  const clearDestination = useCallback(() => {
    setDestination(null)
  }, [])

  const planRoute = useCallback(
    async (profile: RouteProfile) => {
      if (!origin || !destination) return

      setErrorMessage(null)
      setInfeasibleReason(null)

      if (!hasFreeRoutePlansRemaining()) {
        setErrorMessage(`You've used all ${FREE_ROUTE_PLAN_LIMIT} free route plans on this device.`)
        setStatus('error')
        return
      }

      setRouteOptions([])
      setSelectedRouteIndex(0)
      setStatus('loading')

      const straightLineMeters = distanceMeters(origin, destination)
      const maxMeters = MAX_REALISTIC_DISTANCE_METERS[profile]
      if (straightLineMeters > maxMeters) {
        const miles = Math.round(straightLineMeters / METERS_PER_MILE)
        const activityLabel = profile === 'cycling-regular' ? 'a single bike ride' : 'a single walk'
        setInfeasibleReason(
          `These two points are about ${miles} mi apart in a straight line — too far for ${activityLabel}. Try picking closer points, or switch activity.`
        )
        setStatus('infeasible')
        return
      }

      let routes: RouteResult[]
      let usingSampleData = false
      try {
        routes = await fetchRoutes(origin, destination, profile)
      } catch (err) {
        if (err instanceof ApiNotConfiguredError) {
          routes = [buildSampleRoute(origin, destination, profile)]
          usingSampleData = true
        } else if (err instanceof RouteNotPossibleError) {
          setInfeasibleReason(err.message)
          setStatus('infeasible')
          return
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Could not plan a route.')
          setStatus('error')
          return
        }
      }

      const originAqi = nearestAqiReading(origin, aqiReadings)?.value ?? null
      const destinationAqi = nearestAqiReading(destination, aqiReadings)?.value ?? null

      let plans: RoutePlan[] = routes.map((route) => {
        const routeAvgAqi = usingSampleData ? null : averageAqiAlongRoute(route.coordinates, aqiReadings)
        const routeSegments = usingSampleData ? null : buildRouteAqiSegments(route.coordinates, aqiReadings)
        const worstStretch = routeSegments ? findWorstRouteStretch(routeSegments) : null
        return { route, usingSampleData, originAqi, destinationAqi, routeAvgAqi, routeSegments, worstStretch }
      })

      if (!usingSampleData) {
        plans = labelRouteOptions(plans)
        // Default to the cleanest option (or whichever tied for "Best") —
        // matches the app's overall "lead with air quality" framing,
        // while every option stays one tap away via selectRoute below.
        const defaultIndex = plans.findIndex((p) => p.label === 'Best' || p.label === 'Cleanest')
        setSelectedRouteIndex(defaultIndex >= 0 ? defaultIndex : 0)
      }

      setRouteOptions(plans)
      setPlanCount(incrementRoutePlanCount())
      setStatus('ready')
    },
    [origin, destination, aqiReadings]
  )

  const selectRoute = useCallback(
    (index: number) => {
      if (index >= 0 && index < routeOptions.length) setSelectedRouteIndex(index)
    },
    [routeOptions.length]
  )

  const reset = useCallback(() => {
    setRouteOptions([])
    setSelectedRouteIndex(0)
    setErrorMessage(null)
    setInfeasibleReason(null)
    setStatus('idle')
    setOrigin(null)
    setOriginLabel(null)
    setDestination(null)
  }, [])

  const plan = useMemo(() => routeOptions[selectedRouteIndex] ?? null, [routeOptions, selectedRouteIndex])

  return {
    origin,
    originLabel,
    locatingOrigin,
    useCurrentLocationAsOrigin,
    setOriginPlace,
    clearOrigin,
    destination,
    setDestinationPlace,
    clearDestination,
    status,
    plan,
    routeOptions,
    selectedRouteIndex,
    selectRoute,
    errorMessage,
    infeasibleReason,
    planCount,
    // Derived from hasFreeRoutePlansRemaining() (not a raw count
    // comparison) so this automatically respects the temporary
    // UNLIMITED_ROUTE_PLANS override in services/routePlans.ts too.
    freeLimitReached: !hasFreeRoutePlansRemaining(),
    canPlan: origin != null && destination != null,
    planRoute,
    reset,
  }
}

export type RoutePlanning = ReturnType<typeof useRoutePlanning>
