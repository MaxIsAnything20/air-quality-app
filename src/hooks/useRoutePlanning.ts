import { useCallback, useState } from 'react'
import type { AqiReading } from '../types'
import { ApiNotConfiguredError } from '../services/apiError'
import { fetchRoute, RouteProfile, RouteResult } from '../services/routes'
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
}

// Commonly used rough pace estimates (not measured, not personalized) —
// only used to give the sample/placeholder route an honest, clearly
// approximate duration instead of leaving it blank. Real routes get their
// duration straight from OpenRouteService instead of this.
const AVERAGE_WALK_SPEED_MPS = 1.4 // ~5 km/h
const AVERAGE_CYCLE_SPEED_MPS = 4.2 // ~15 km/h

// A clearly-labeled placeholder route (straight line between the two real
// points, with an honest estimated duration from a commonly-used average
// pace) shown only when OPENROUTESERVICE_API_KEY isn't set server-side —
// see api/routes.ts. Never presented as real turn-by-turn directions;
// RoutePlanningView.tsx always shows a "sample route" banner alongside it,
// and this app deliberately does NOT compute an "AQI along the route" for
// it (see planRoute below) since that path shape isn't real.
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
 * useCurrentLocationAsOrigin) or a real Nominatim place search (same
 * search used for the destination). Nothing is planned until both ends
 * are set and the person explicitly asks for routes.
 *
 * Once both ends are set, planRoute requests a real route from
 * OpenRouteService (see services/routes.ts), falling back to a
 * clearly-labeled sample straight-line route when
 * OPENROUTESERVICE_API_KEY isn't configured — never silently pretending a
 * placeholder is a real route. AQI figures (average, per-segment, worst
 * stretch — see services/routeAir.ts) are always real, pulled from
 * whatever aqiReadings the caller passes in, and only computed for real
 * route geometry.
 */
export function useRoutePlanning(aqiReadings: AqiReading[]) {
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [originLabel, setOriginLabel] = useState<string | null>(null)
  const [locatingOrigin, setLocatingOrigin] = useState(false)

  const [destination, setDestination] = useState<(LatLng & { label: string }) | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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

      if (!hasFreeRoutePlansRemaining()) {
        setErrorMessage(`You've used all ${FREE_ROUTE_PLAN_LIMIT} free route plans on this device.`)
        setStatus('error')
        return
      }

      setErrorMessage(null)
      setPlan(null)
      setStatus('loading')

      let route: RouteResult
      let usingSampleData = false
      try {
        route = await fetchRoute(origin, destination, profile)
      } catch (err) {
        if (err instanceof ApiNotConfiguredError) {
          route = buildSampleRoute(origin, destination, profile)
          usingSampleData = true
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Could not plan a route.')
          setStatus('error')
          return
        }
      }

      const routeAvgAqi = usingSampleData ? null : averageAqiAlongRoute(route.coordinates, aqiReadings)
      const routeSegments = usingSampleData ? null : buildRouteAqiSegments(route.coordinates, aqiReadings)
      const worstStretch = routeSegments ? findWorstRouteStretch(routeSegments) : null
      const originAqi = nearestAqiReading(origin, aqiReadings)?.value ?? null
      const destinationAqi = nearestAqiReading(destination, aqiReadings)?.value ?? null

      setPlan({ route, usingSampleData, originAqi, destinationAqi, routeAvgAqi, routeSegments, worstStretch })
      setPlanCount(incrementRoutePlanCount())
      setStatus('ready')
    },
    [origin, destination, aqiReadings]
  )

  const reset = useCallback(() => {
    setPlan(null)
    setErrorMessage(null)
    setStatus('idle')
    setOrigin(null)
    setOriginLabel(null)
    setDestination(null)
  }, [])

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
    errorMessage,
    planCount,
    freeLimitReached: planCount >= FREE_ROUTE_PLAN_LIMIT,
    canPlan: origin != null && destination != null,
    planRoute,
    reset,
  }
}

export type RoutePlanning = ReturnType<typeof useRoutePlanning>
