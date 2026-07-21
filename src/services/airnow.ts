import { AirNowForecast, AirNowObservation } from './airnowTypes'
import { AqiReading, PollutantReading, aqiLevelFromValue } from '../types'
import { ApiNotConfiguredError } from './apiError'

// Always our own `/api/airnow` path now — handled by the Vite dev
// middleware in dev (vite.config.ts) and by api/airnow.ts in production.
// Neither the client nor this file ever sees AIRNOW_API_KEY; the server
// layer attaches it. See README "Deploying this for real".
const BASE_URL = '/api/airnow'

// ⚠️ MIGRATION NOTE (checked directly against docs.airnowapi.org/webservices,
// July 2026 — re-check yourself, this may be stale by the time you read it):
//
// AirNow's docs list "Current Observations by Reporting Area > By
// latitude/longitude" and "Forecasts > By latitude/longitude" — which is
// what these two paths below actually are — under a section titled "Web
// Services that will be retired in the fall of 2026". This does NOT mean
// lat/long queries are going away entirely: the same docs page separately
// lists still-current services ("Current Forecasts: By Reporting Area,
// Lat/Long, or Zip Code" and "Current Observations: By Zip Code or
// Lat/Long") that also accept lat/long, which reads like a consolidation
// of several legacy single-purpose endpoints into unified ones rather than
// a removal of the capability. What IS a real loss: the historical
// (not current) observation endpoint is being narrowed to state-level
// queries only, dropping lat/long/zip — irrelevant here since this app
// never calls AirNow's historical endpoint (see historyLog.ts's own
// rolling log instead).
//
// I could not get the exact replacement path/params for current
// observations+forecast from the public docs — AirNow's site builds exact
// query URLs through a "Generate URL" tool that needs a logged-in
// developer account to render, which this environment doesn't have. If
// you're reading this after fall 2026 and requests here start failing,
// that's almost certainly why: log into docs.airnowapi.org yourself, find
// the current (non-retired) equivalent of these two paths, and swap them
// in right here — everything else (the proxy layer, the AqiReading shape,
// the UI) should keep working unchanged since the response shape for
// per-pollutant observations isn't expected to change.
//
// In the meantime this isn't a silent failure risk: every catch block in
// useAirQuality.ts already falls back to sample data on ANY fetch error
// (wrong key, rate limit, network blip, or a 404 once these retire) — so
// the worst case between now and a manual fix is the app quietly switching
// to its "using sample data" banner, not a crash.
const CURRENT_OBSERVATIONS_PATH = '/aq/observation/latLong/current'
const FORECAST_PATH = '/aq/forecast/latLong'

async function airnowFetch<T>(path: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}?${params}`)
  if (res.status === 501) {
    const body = await res.json().catch(() => null)
    throw new ApiNotConfiguredError(body?.error ?? 'AirNow API key is not configured on the server.')
  }
  if (!res.ok) {
    throw new Error(`AirNow request failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchCurrentObservations(
  lat: number,
  lng: number,
  distance = 25
): Promise<AirNowObservation[]> {
  const params = new URLSearchParams({
    format: 'application/json',
    latitude: String(lat),
    longitude: String(lng),
    distance: String(distance)
  })
  return airnowFetch<AirNowObservation[]>(CURRENT_OBSERVATIONS_PATH, params)
}

export async function fetchForecast(
  lat: number,
  lng: number,
  distance = 25
): Promise<AirNowForecast[]> {
  const params = new URLSearchParams({
    format: 'application/json',
    latitude: String(lat),
    longitude: String(lng),
    distance: String(distance)
  })
  return airnowFetch<AirNowForecast[]>(FORECAST_PATH, params)
}

// AirNow returns one entry per pollutant (PM2.5, ozone, etc) — the AQI
// that gets reported to the public is the worst of those, since that's
// the pollutant actually driving health risk at that moment.
export function worstReading<T extends { AQI: number }>(readings: T[]): T | undefined {
  return readings.reduce<T | undefined>((worst, r) => (!worst || r.AQI > worst.AQI ? r : worst), undefined)
}

// AirNow's `current/` and `forecast/` endpoints return one entry per
// pollutant for the single nearest reporting station — this keeps all of
// them (not just the worst) so the UI can show the full breakdown AirNow
// itself shows, e.g. a station that's "Moderate" overall on ozone while
// also reporting an elevated PM2.5 reading worth knowing about. Filtered
// to the same lat/lng as `worst` in case a query ever mixes entries from
// more than one nearby station.
export function buildPollutantBreakdown<
  T extends { AQI: number; ParameterName: string; Latitude: number; Longitude: number }
>(all: T[], worst: T): PollutantReading[] {
  return all
    .filter((o) => o.Latitude === worst.Latitude && o.Longitude === worst.Longitude)
    .map((o) => ({ parameter: o.ParameterName, aqi: o.AQI, level: aqiLevelFromValue(o.AQI) }))
    .sort((a, b) => b.aqi - a.aqi)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// AirNow gives the observation date/hour/timezone as separate fields rather
// than one combined timestamp — this turns "2026-07-19" + 14 + "PDT" into
// "Jul 19, 2:00 PM PDT" for the station popup.
export function formatObservedAt(dateObserved: string, hourObserved: number, timeZone: string): string {
  const [, month, day] = dateObserved.split('-').map(Number)
  const suffix = hourObserved === 0 ? '12:00 AM' : hourObserved < 12 ? `${hourObserved}:00 AM` : hourObserved === 12 ? '12:00 PM' : `${hourObserved - 12}:00 PM`
  return `${MONTHS[(month ?? 1) - 1]} ${day}, ${suffix} ${timeZone}`
}

function stationNameFor(observation: AirNowObservation): string {
  return observation.StateCode ? `${observation.ReportingArea}, ${observation.StateCode}` : observation.ReportingArea
}

// Offsets a lat/lng by a given distance in km, correcting the longitude
// delta for latitude so the grid stays roughly square regardless of where
// on the globe it's centered.
function offsetCoords(lat: number, lng: number, dLatKm: number, dLngKm: number) {
  return {
    lat: lat + dLatKm / 111,
    lng: lng + dLngKm / (111 * Math.cos((lat * Math.PI) / 180))
  }
}

// A single lat/lng only ever returns the *one* nearest reporting station,
// so plotting just that gives you one circle showing one color — which is
// why "Good" (or any variety at all) basically never showed up on the map
// before this. AirNow's own map instead plots every station it has, so
// neighboring areas can legitimately differ (one town under a smoke plume,
// the next one clear). This approximates that by sampling a small grid of
// points around the center and plotting each station that answers at its
// own real coordinates — not the query point — deduping stations that
// multiple grid points happen to hit.
//
// Trade-off worth knowing: this is `1 + grid points` API calls instead of
// one, so it's more sensitive to AirNow's per-key rate limit than the rest
// of the app. If you hit that, cut GRID_RADIUS_KM's fan-out down.
const GRID_OFFSETS_KM: { dLat: number; dLng: number }[] = [
  { dLat: 0, dLng: 0 },
  { dLat: 35, dLng: 0 },
  { dLat: -35, dLng: 0 },
  { dLat: 0, dLng: 35 },
  { dLat: 0, dLng: -35 }
]

export async function fetchRegionalObservations(lat: number, lng: number): Promise<AqiReading[]> {
  const points = GRID_OFFSETS_KM.map((o) => offsetCoords(lat, lng, o.dLat, o.dLng))

  const results = await Promise.allSettled(points.map((p) => fetchCurrentObservations(p.lat, p.lng)))

  const seen = new Set<string>()
  const readings: AqiReading[] = []

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const worst = worstReading(result.value)
    if (!worst) continue

    const key = `${worst.Latitude.toFixed(2)},${worst.Longitude.toFixed(2)}`
    if (seen.has(key)) continue // multiple grid points can land on the same nearest station
    seen.add(key)

    readings.push({
      value: worst.AQI,
      level: aqiLevelFromValue(worst.AQI),
      lat: worst.Latitude,
      lng: worst.Longitude,
      radiusMeters: 8000,
      stationName: stationNameFor(worst),
      pollutant: worst.ParameterName,
      observedAt: formatObservedAt(worst.DateObserved, worst.HourObserved, worst.LocalTimeZone),
      pollutants: buildPollutantBreakdown(result.value, worst)
    })
  }

  return readings
}

// Same grid-sampling idea as fetchRegionalObservations, but against AirNow's
// forecast endpoint — this is what backs the time slider's "Tomorrow" step.
// AirNow's forecast has no smoke/fire equivalent, so this only ever powers
// the AQI layer; the map explicitly says so on the other layers rather than
// showing something invented.
export async function fetchRegionalForecast(lat: number, lng: number): Promise<AqiReading[]> {
  const points = GRID_OFFSETS_KM.map((o) => offsetCoords(lat, lng, o.dLat, o.dLng))

  const results = await Promise.allSettled(points.map((p) => fetchForecast(p.lat, p.lng)))

  const seen = new Set<string>()
  const readings: AqiReading[] = []

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const worst = worstReading(result.value)
    if (!worst) continue

    const key = `${worst.Latitude.toFixed(2)},${worst.Longitude.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)

    readings.push({
      value: worst.AQI,
      level: aqiLevelFromValue(worst.AQI),
      lat: worst.Latitude,
      lng: worst.Longitude,
      radiusMeters: 8000,
      stationName: worst.StateCode ? `${worst.ReportingArea}, ${worst.StateCode}` : worst.ReportingArea,
      pollutant: worst.ParameterName,
      observedAt: `Forecast for ${worst.DateForecast}`,
      pollutants: buildPollutantBreakdown(result.value, worst)
    })
  }

  return readings
}
