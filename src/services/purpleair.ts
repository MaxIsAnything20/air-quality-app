import { PurpleAirReading, aqiLevelFromValue, pm25ToAqi } from '../types'
import { ApiNotConfiguredError } from './apiError'

// Always our own `/api/purpleair` path — handled by the Vite dev middleware
// in dev (vite.config.ts) and by api/purpleair.ts in production. Same
// pattern as airnow.ts: neither the client nor this file ever sees
// PURPLEAIR_API_KEY, the server layer attaches it as the X-API-Key header.
// See README "Deploying this for real".
const BASE_URL = '/api/purpleair'

const FIELDS = ['name', 'latitude', 'longitude', 'pm2.5_cf_1', 'humidity', 'last_seen']

interface PurpleAirApiResponse {
  fields: string[]
  data: (string | number | null)[][]
}

/**
 * EPA's national PM2.5 correction for PurpleAir sensors during wildfire
 * smoke, derived from the AirFire/EPA "Fire and Smoke Map" work. PurpleAir's
 * raw PM2.5 reading (pm2.5_cf_1) runs noticeably high in smoke because of how
 * its laser counts particles, so this is applied before converting to AQI —
 * without it, PurpleAir-driven AQI would be inflated well above nearby
 * official monitors during exactly the events people care about most.
 * Formula: PM2.5 = 0.52 * PM2.5_cf_1 - 0.086 * RH + 5.75
 */
function applyEpaCorrection(pm25Raw: number, humidity: number): number {
  const corrected = 0.52 * pm25Raw - 0.086 * humidity + 5.75
  return Math.max(0, corrected)
}

export interface BoundingBox {
  nwLat: number
  nwLng: number
  seLat: number
  seLng: number
}

/** A roughly-square bounding box (in degrees) around a point, `radiusKm` out
 *  in each direction — PurpleAir's search API filters by box, not radius. */
export function boundingBoxAround(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
  return {
    nwLat: lat + latDelta,
    nwLng: lng - lngDelta,
    seLat: lat - latDelta,
    seLng: lng + lngDelta
  }
}

export async function fetchPurpleAirSensors(box: BoundingBox): Promise<PurpleAirReading[]> {
  const params = new URLSearchParams({
    fields: FIELDS.join(','),
    location_type: '0', // outside sensors only, excludes indoor units
    max_age: '3600', // drop anything that hasn't reported in the last hour
    nwlat: String(box.nwLat),
    nwlng: String(box.nwLng),
    selat: String(box.seLat),
    selng: String(box.seLng)
  })

  const res = await fetch(`${BASE_URL}/v1/sensors?${params}`)
  if (res.status === 501) {
    const body = await res.json().catch(() => null)
    throw new ApiNotConfiguredError(body?.error ?? 'PurpleAir API key is not configured on the server.')
  }
  if (!res.ok) {
    throw new Error(`PurpleAir request failed: ${res.status}`)
  }

  const body: PurpleAirApiResponse = await res.json()
  const idx = (field: string) => body.fields.indexOf(field)
  const nameIdx = idx('name')
  const latIdx = idx('latitude')
  const lngIdx = idx('longitude')
  const pm25Idx = idx('pm2.5_cf_1')
  const humidityIdx = idx('humidity')
  const lastSeenIdx = idx('last_seen')
  const sensorIndexIdx = idx('sensor_index')

  const now = Date.now()

  return body.data
    .map((row): PurpleAirReading | null => {
      const lat = Number(row[latIdx])
      const lng = Number(row[lngIdx])
      const pm25Raw = Number(row[pm25Idx])
      const humidity = Number(row[humidityIdx])
      const lastSeen = Number(row[lastSeenIdx]) // unix seconds
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(pm25Raw)) return null

      const pm25 = applyEpaCorrection(pm25Raw, Number.isFinite(humidity) ? humidity : 50)
      const aqi = pm25ToAqi(pm25)

      return {
        id: Number(row[sensorIndexIdx]) || 0,
        name: String(row[nameIdx] ?? 'Unnamed sensor'),
        lat,
        lng,
        pm25: Math.round(pm25 * 10) / 10,
        aqi,
        level: aqiLevelFromValue(aqi),
        updatedMinutesAgo: Number.isFinite(lastSeen)
          ? Math.max(0, Math.round((now / 1000 - lastSeen) / 60))
          : 0
      }
    })
    .filter((r): r is PurpleAirReading => r !== null)
}
