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
}

// Commonly used rough pace estimates (not measured, not personalized) —
// only used to give the sample/placeholder route an honest, clearly
// approximate duration instead of leaving it blank. Real routes get their
// duration straight from OpenRouteService instead of this.
const AVERAGE_WALK_SPEED_MPS = 1.4 // ~5 km/h
const AVERAGE_CYCLE_SPEED_MPS = 4.2 // ~15 km/h

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestAqiReading(point: LatLng, readings: AqiReading[]): AqiReading | null {
  let best: AqiReading | null = null
  let bestDist = Infinity
  for (const r of readings) {
    const d = distanceMeters(point, { lat: r.lat, lng: r.lng })
    if (d < bestDist) {
      bestDist = d
      best = r
    }
  }
  return best
}

// Samples points along the route and averages each one's nearest real AQI
// reading — same "pair a coordinate with the closest station" idea as
// activityLog.ts's exposure math, just applied to a planned path instead
// of a recorded one. Only meaningful for a real route geometry; the sample
// placeholder route deliberately never calls this (see planRouteTo below).
function averageAqiAlongRoute(coordinates: [number, number][], readings: AqiReading[]): number | null {
  if (readings.length === 0 || coordinates.length === 0) return null
  const step = Math.max(1, Math.floor(coordinates.length / 20))
  const samples: number[] = []
  for (let i = 0; i < coordinates.length; i += step) {
    const [lat, lng] = coordinates[i]
    const nearest = nearestAqiReading({ lat, lng }, readings)
    if (nearest) samples.push(nearest.value)
  }
  if (samples.length === 0) return null
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
}

// A clearly-labeled placeholder route (straight line between the two real
// points, with an honest estimated duration from a commonly-used average
// pace) shown only when OPENROUTESERVICE_API_KEY isn't set server-side —
// see api/routes.ts. Never presented as real turn-by-turn directions;
// RoutePlanningView.tsx always shows a "sample route" banner alongside it,
// and this app deliberately does NOT compute an "AQI along the route" for
// it (see planRouteTo) since that path shape isn't real.
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
 * Drives the route-planning screen: resolves the real device location,
 * requests a real route from OpenRouteService (see services/routes.ts),
 * and falls back to a clearly-labeled sample route when
 * OPENROUTESERVICE_API_KEY isn't configured — never silently pretending a
 * placeholder is a real route. AQI figures are always real, pulled from
 * whatever aqiReadings the caller passes in (the same live/sample AirNow
 * data already powering the rest of the app).
 */
export function useRoutePlanning(aqiReadings: AqiReading[]) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'loading' | 'ready' | 'error'>('idle')
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null)
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [planCount, setPlanCount] = useState(() => getRoutePlanCount())

  const planRouteTo = useCallback(
    async (destination: LatLng & { label: string }, profile: RouteProfile = 'foot-walking') => {
      if (!hasFreeRoutePlansRemaining()) {
        setErrorMessage(`You've used all ${FREE_ROUTE_PLAN_LIMIT} free route plans on this device.`)
        setStatus('error')
        return
      }

      setErrorMessage(null)
      setPlan(null)
      setDestinationLabel(destination.label)
      setStatus('locating')

      let originPoint: LatLng
      try {
        originPoint = await getCurrentPosition()
        setOrigin(originPoint)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not get your location.')
        setStatus('error')
        return
      }

      setStatus('loading')

      let route: RouteResult
      let usingSampleData = false
      try {
        route = await fetchRoute(originPoint, destination, profile)
      } catch (err) {
        if (err instanceof ApiNotConfiguredError) {
          route = buildSampleRoute(originPoint, destination, profile)
          usingSampleData = true
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Could not plan a route.')
          setStatus('error')
          return
        }
      }

      const routeAvgAqi = usingSampleData ? null : averageAqiAlongRoute(route.coordinates, aqiReadings)
      const originAqi = nearestAqiReading(originPoint, aqiReadings)?.value ?? null
      const destinationAqi = nearestAqiReading(destination, aqiReadings)?.value ?? null

      setPlan({ route, usingSampleData, originAqi, destinationAqi, routeAvgAqi })
      setPlanCount(incrementRoutePlanCount())
      setStatus('ready')
    },
    [aqiReadings]
  )

  const reset = useCallback(() => {
    setPlan(null)
    setErrorMessage(null)
    setDestinationLabel(null)
    setStatus('idle')
  }, [])

  return {
    status,
    origin,
    destinationLabel,
    plan,
    errorMessage,
    planCount,
    freeLimitReached: planCount >= FREE_ROUTE_PLAN_LIMIT,
    planRouteTo,
    reset,
  }
}

export type RoutePlanning = ReturnType<typeof useRoutePlanning>
