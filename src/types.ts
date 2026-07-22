export type AqiLevel =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'veryunhealthy'
  | 'hazardous'

export interface PollutantReading {
  /** e.g. "PM2.5", "OZONE" — AirNow's own parameter name, not reformatted. */
  parameter: string
  aqi: number
  level: AqiLevel
}

export interface AqiReading {
  value: number
  level: AqiLevel
  lat: number
  lng: number
  radiusMeters: number
  /** e.g. "San Francisco, CA" — the AirNow reporting area/station name. */
  stationName: string
  /** The pollutant driving this reading, e.g. "PM2.5" or "OZONE" — always
   * the same as pollutants[0].parameter when pollutants is present. */
  pollutant: string
  /** Human-readable observation time, e.g. "Jul 19, 2:00 PM PDT". */
  observedAt: string
  /** All pollutants AirNow reported for this station, worst first —
   * AirNow's own AQI is just the worst of these, but a station can be
   * "Moderate" overall while also reporting an elevated second pollutant
   * that's worth seeing. Optional since the single-reading fallback path
   * doesn't always have it; UI should handle undefined/length-1 gracefully. */
  pollutants?: PollutantReading[]
}

/** A specific AQI monitor tapped on the map, paired with which time slider
 * step it came from ('today' | 'tomorrow' | an ISO past date). Without the
 * step, downstream consumers (the AI summary, the summary card) have no
 * way to know a reading is a forecast or a three-day-old snapshot rather
 * than live — see src/utils/timeSteps.ts. */
export interface RegionSelection {
  reading: AqiReading
  step: string
}

export interface FieldReport {
  id: string
  kind: 'fire' | 'smoke'
  title: string
  updatedMinutesAgo: number
  lat: number
  lng: number
}

export interface ExposureStats {
  currentAqi: number
  daysUnhealthyThisMonth: number
  forecastPeakAqi: number
}

export interface DailyExposure {
  /** ISO date, e.g. "2026-07-03" */
  date: string
  aqi: number
  level: AqiLevel
}

export interface ConditionAlert {
  level: AqiLevel
  headline: string
  detail: string
}

export interface PurpleAirReading {
  id: number
  name: string
  lat: number
  lng: number
  pm25: number
  aqi: number
  level: AqiLevel
  updatedMinutesAgo: number
}

// EPA's PM2.5 AQI breakpoints, as revised May 2024 (the "Good" ceiling moved
// from 12.0 to 9.0 µg/m3, and the top three breakpoints were also tightened).
// Source: EPA final rule, 89 FR 16202 (Mar 6, 2024).
const PM25_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, aqiLow: 0, aqiHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, aqiLow: 51, aqiHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, aqiLow: 101, aqiHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, aqiLow: 151, aqiHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, aqiLow: 201, aqiHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, aqiLow: 301, aqiHigh: 500 }
] as const

/** Converts a PM2.5 concentration (µg/m3) into an EPA AQI value (0-500). */
export function pm25ToAqi(pm25: number): number {
  const clamped = Math.max(0, pm25)
  const bp =
    PM25_BREAKPOINTS.find((b) => clamped <= b.cHigh) ?? PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1]
  const aqi =
    ((bp.aqiHigh - bp.aqiLow) / (bp.cHigh - bp.cLow)) * (Math.min(clamped, bp.cHigh) - bp.cLow) + bp.aqiLow
  return Math.round(Math.min(aqi, 500))
}

export function aqiLevelFromValue(value: number): AqiLevel {
  if (value <= 50) return 'good'
  if (value <= 100) return 'moderate'
  if (value <= 150) return 'sensitive'
  if (value <= 200) return 'unhealthy'
  if (value <= 300) return 'veryunhealthy'
  return 'hazardous'
}

/**
 * Converts an AQI value (0-500) into a 0-100 "cleaner air" score, where
 * higher is better. This is the flat percentage-style presentation used
 * on the home screen ("82% Excellent") and shared with the personal
 * exposure score, rather than exposing the raw EPA AQI scale everywhere.
 * 0 AQI -> 100, 200 AQI -> 0, linear and clamped in between —
 * intentionally simple, not a claim of clinical precision.
 */
export function aqiToScore(aqi: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - aqi / 2)))
}

/** Plain-language label for an aqiToScore() value, distinct from
 * AqiLevel's labels (aqiColors.ts's aqiLevelLabel) since this is a
 * different axis — a 0-100 score, not an AQI category — even though the
 * boundaries are aligned. */
export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  if (score >= 20) return 'Poor'
  return 'Very poor'
}

export type SmokeDensity = 'light' | 'medium' | 'heavy'

export interface SmokePolygon {
  id: string
  density: SmokeDensity
  /** Raw density value from NOAA (roughly: 5 = light, 16 = medium, 27 = heavy) */
  densityValue: number | null
  startTime: string | null // ISO string, UTC
  endTime: string | null // ISO string, UTC
  satellite: string | null
  /** [lng, lat][] ring, matches GeoJSON polygon ring order */
  coordinates: [number, number][]
}

// --- Activity tracking (foreground-only — see services/activityLog.ts for
// why, and the README's "Roadmap" section for what a native rebuild adds) ---

export type ActivityType =
  | 'run'
  | 'trailRun'
  | 'walk'
  | 'strollerWalk'
  | 'dogWalk'
  | 'hike'
  | 'roadCycle'
  | 'mountainBike'
  | 'commuteWalk'
  | 'commuteCycle'
  | 'commuteDrive'
  | 'commuteTransit'
  | 'skateboard'
  | 'scooter'
  | 'wheelchair'
  | 'swimOutdoor'
  | 'yogaOutdoor'
  | 'gardening'
  | 'outdoorWork'
  | 'picnic'
  | 'camping'
  | 'fishing'
  | 'golf'
  | 'tennisOutdoor'
  | 'soccer'
  | 'basketballOutdoor'
  | 'other'

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trailRun: 'Trail run',
  walk: 'Walk',
  strollerWalk: 'Stroller walk',
  dogWalk: 'Dog walk',
  hike: 'Hike',
  roadCycle: 'Road cycle',
  mountainBike: 'Mountain bike',
  commuteWalk: 'Commute (walk)',
  commuteCycle: 'Commute (cycle)',
  commuteDrive: 'Commute (drive)',
  commuteTransit: 'Commute (transit)',
  skateboard: 'Skateboard',
  scooter: 'Scooter',
  wheelchair: 'Wheelchair',
  swimOutdoor: 'Outdoor swim',
  yogaOutdoor: 'Outdoor yoga',
  gardening: 'Gardening',
  outdoorWork: 'Outdoor work',
  picnic: 'Picnic',
  camping: 'Camping',
  fishing: 'Fishing',
  golf: 'Golf',
  tennisOutdoor: 'Tennis',
  soccer: 'Soccer',
  basketballOutdoor: 'Basketball',
  other: 'Other'
}

/** Groups activity types for the picker UI so dozens of options stay
 * scannable instead of one long flat list. */
export const ACTIVITY_TYPE_GROUPS: { label: string; types: ActivityType[] }[] = [
  { label: 'Cardio', types: ['run', 'trailRun', 'walk', 'strollerWalk', 'dogWalk', 'hike', 'roadCycle', 'mountainBike'] },
  { label: 'Commute', types: ['commuteWalk', 'commuteCycle', 'commuteDrive', 'commuteTransit'] },
  { label: 'Rolling', types: ['skateboard', 'scooter', 'wheelchair'] },
  { label: 'Sport', types: ['swimOutdoor', 'golf', 'tennisOutdoor', 'soccer', 'basketballOutdoor'] },
  { label: 'Outdoor time', types: ['yogaOutdoor', 'gardening', 'outdoorWork', 'picnic', 'camping', 'fishing', 'other'] }
]

/** A single geo-timestamped sample recorded during an activity. nearestAqi
 * is filled in opportunistically from whichever AQI station reading was
 * closest at the moment the point was recorded — not a full route-pollution
 * model (that's the separate exposure-score roadmap item), just the best
 * real number available at tracking time. */
export interface ActivityPoint {
  lat: number
  lng: number
  timestamp: number
  nearestAqi: number | null
}

export interface Activity {
  id: string
  type: ActivityType
  startedAt: number
  endedAt: number | null
  points: ActivityPoint[]
  // 'active' survives a page reload (see services/activityLog.ts) so an
  // interrupted session can be resumed or explicitly discarded instead of
  // silently vanishing — the closest a browser tab can get to "handle
  // app-closed-mid-activity gracefully" without a native background process.
  status: 'active' | 'completed' | 'discarded'
}
