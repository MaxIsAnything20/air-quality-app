import { AqiLevel, AqiReading, PurpleAirReading } from '../types'

// Ranks AqiLevel for comparison — higher is worse. Matches the order
// AQI_GUIDANCE/aqiColor/aqiLevelLabel already use elsewhere in the app.
const LEVEL_RANK: Record<AqiLevel, number> = {
  good: 0,
  moderate: 1,
  sensitive: 2,
  unhealthy: 3,
  veryunhealthy: 4,
  hazardous: 5
}

export interface DivergenceAlert {
  sensor: PurpleAirReading
  nearestStation: AqiReading
  distanceKm: number
  /** sensor's level rank minus station's level rank — positive means the
   *  citizen sensor reads worse than the official station. */
  levelGap: number
  /** sensor.aqi - nearestStation.value */
  aqiGap: number
}

// Haversine distance in km — same formula family as the offset math in
// services/airnow.ts and purpleair.ts, just the inverse (distance rather
// than an offset point).
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// AirNow's regional grid (fetchRegionalObservations in services/airnow.ts)
// samples points roughly 35km apart, so "nearest official station" can
// legitimately be tens of km from a given PurpleAir sensor — beyond this,
// treat it as too far apart to be a meaningful same-event comparison
// rather than a real divergence signal.
const MAX_PAIR_DISTANCE_KM = 60

// Trip on whichever condition fires first: at least two full AQI
// categories worse (e.g. Moderate -> Unhealthy), OR at least a 50-point
// jump even within a category range near a boundary (e.g. Moderate 55 vs
// Moderate 95 is technically the same category but a very different
// experience).
const MIN_LEVEL_GAP = 2
const MIN_AQI_GAP = 50

/**
 * Flags PurpleAir sensors reading notably worse than the nearest official
 * AirNow station. This is the actionable direction: a citizen sensor
 * spiking ahead of official data usually means a fast-developing local
 * event (a new fire, a smoke plume drifting in) that the hourly-updated
 * official network hasn't caught up to yet. The reverse (official worse
 * than PurpleAir) isn't flagged — that's far more often just normal
 * sensor noise or siting differences, not a signal worth surfacing.
 */
export function detectDivergence(
  aqiReadings: AqiReading[],
  purpleAirReadings: PurpleAirReading[]
): DivergenceAlert[] {
  if (aqiReadings.length === 0 || purpleAirReadings.length === 0) return []

  const alerts: DivergenceAlert[] = []

  for (const sensor of purpleAirReadings) {
    let nearest: AqiReading | null = null
    let nearestDist = Infinity
    for (const station of aqiReadings) {
      const d = distanceKm(sensor.lat, sensor.lng, station.lat, station.lng)
      if (d < nearestDist) {
        nearestDist = d
        nearest = station
      }
    }
    if (!nearest || nearestDist > MAX_PAIR_DISTANCE_KM) continue

    const levelGap = LEVEL_RANK[sensor.level] - LEVEL_RANK[nearest.level]
    const aqiGap = sensor.aqi - nearest.value

    if (levelGap >= MIN_LEVEL_GAP || aqiGap >= MIN_AQI_GAP) {
      alerts.push({ sensor, nearestStation: nearest, distanceKm: nearestDist, levelGap, aqiGap })
    }
  }

  return alerts.sort((a, b) => b.aqiGap - a.aqiGap)
}

/** One-sentence note suitable for handing to the AI summary as extra
 *  grounding context — kept factual/numeric on purpose, same "only use
 *  the numbers given" discipline as the rest of the summary prompt in
 *  api/summary.ts. Returns null when there's nothing to say. */
export function summarizeDivergence(alerts: DivergenceAlert[]): string | null {
  if (alerts.length === 0) return null
  const worst = alerts[0]
  const count = alerts.length
  const subject = count > 1 ? `${count} nearby citizen sensors` : `A nearby citizen sensor (${worst.sensor.name})`
  return `${subject} currently read notably worse (up to AQI ${worst.sensor.aqi}) than the nearest official station near ${worst.nearestStation.stationName} (AQI ${worst.nearestStation.value}, about ${Math.round(worst.distanceKm)}km away) — this can mean a fast-developing local event the official monitor hasn't caught up to yet.`
}
