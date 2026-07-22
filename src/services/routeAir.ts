import type { AqiLevel, AqiReading } from '../types'
import { aqiLevelFromValue } from '../types'

export interface LatLng {
  lat: number
  lng: number
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two points, in meters. Shared by every
 * "pair this coordinate with the nearest real reading" calculation in the
 * app — route planning here, activity exposure math in activityLog.ts. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** The real AQI reading whose station is physically closest to `point` —
 * the same "closest station stands in for this exact spot" approach used
 * for activity exposure math, just applied to a planned route instead of
 * a recorded one. */
export function nearestAqiReading(point: LatLng, readings: AqiReading[]): AqiReading | null {
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

/** Averages the nearest-station AQI at ~20 evenly spaced points along the
 * route. Only meaningful for a real route geometry — never called for the
 * sample straight-line placeholder (see useRoutePlanning.ts), since that
 * path shape isn't real. */
export function averageAqiAlongRoute(coordinates: [number, number][], readings: AqiReading[]): number | null {
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

export interface RouteAqiSegment {
  coordinates: [number, number][]
  aqi: number
  level: AqiLevel
}

/**
 * Walks the real route geometry point-by-point, tags each point with its
 * nearest real station's AQI level, and merges consecutive same-level
 * points into one colored segment — so the route line itself becomes a
 * real, spatial picture of where air quality actually changes along this
 * exact path, rather than a single trip-wide average. Every color traces
 * back to a real station reading; nothing here is interpolated or guessed
 * between stations, just "closest known reading" repeated per point — the
 * same honesty rule as nearestAqiReading/averageAqiAlongRoute above. Only
 * called for real route geometry, never the sample placeholder.
 */
export function buildRouteAqiSegments(coordinates: [number, number][], readings: AqiReading[]): RouteAqiSegment[] {
  if (coordinates.length < 2 || readings.length === 0) return []

  const pointLevels = coordinates.map(([lat, lng]) => {
    const nearest = nearestAqiReading({ lat, lng }, readings)
    return nearest ? { aqi: nearest.value, level: aqiLevelFromValue(nearest.value) } : null
  })

  const segments: RouteAqiSegment[] = []
  let segStart = 0

  for (let i = 1; i <= coordinates.length; i++) {
    const prev = pointLevels[i - 1]
    const current = i < coordinates.length ? pointLevels[i] : null
    const levelChanged = !current || !prev || current.level !== prev.level
    if (levelChanged) {
      if (prev) {
        // Include the boundary point so adjacent segments visually touch
        // on the map instead of leaving a gap.
        const end = Math.min(i + 1, coordinates.length)
        segments.push({
          coordinates: coordinates.slice(segStart, end),
          aqi: prev.aqi,
          level: prev.level
        })
      }
      segStart = i
    }
  }

  return segments
}

export interface WorstRouteStretch {
  segment: RouteAqiSegment
  distanceFromStartMeters: number
}

/** Finds the single worst-air segment along the route (by AQI value) and
 * how far into the trip it starts — a real, computed heads-up instead of
 * just an average, e.g. "air quality dips to Moderate about 1.2 km in."
 * Returns null when the whole route is uniformly good, since there's
 * nothing meaningful to flag. */
export function findWorstRouteStretch(segments: RouteAqiSegment[]): WorstRouteStretch | null {
  if (segments.length === 0) return null

  let worst = segments[0]
  for (const seg of segments) {
    if (seg.aqi > worst.aqi) worst = seg
  }

  if (worst.level === 'good' && segments.every((s) => s.level === 'good')) return null

  let distance = 0
  for (const seg of segments) {
    if (seg === worst) break
    for (let i = 1; i < seg.coordinates.length; i++) {
      distance += distanceMeters(
        { lat: seg.coordinates[i - 1][0], lng: seg.coordinates[i - 1][1] },
        { lat: seg.coordinates[i][0], lng: seg.coordinates[i][1] }
      )
    }
  }

  return { segment: worst, distanceFromStartMeters: distance }
}
