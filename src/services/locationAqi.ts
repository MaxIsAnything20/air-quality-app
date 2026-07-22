import { fetchCurrentObservations, worstReading } from './airnow'
import type { AqiLevel } from '../types'
import { aqiLevelFromValue } from '../types'

export interface LocationAqi {
  value: number
  level: AqiLevel
  stationName: string
}

/**
 * Live AQI for one arbitrary saved location — reuses the same
 * /api/airnow-backed fetchCurrentObservations() the rest of the app
 * already calls, just for a single point rather than the 5-point regional
 * grid fetchRegionalObservations() builds for the map. Returns null on
 * any failure (no station nearby, API key not configured, network error)
 * rather than throwing, since a saved-locations list should degrade one
 * row at a time, not blank the whole screen if one lookup fails.
 */
export async function fetchAqiForLocation(lat: number, lng: number): Promise<LocationAqi | null> {
  try {
    const observations = await fetchCurrentObservations(lat, lng)
    const worst = worstReading(observations)
    if (!worst) return null
    return {
      value: worst.AQI,
      level: aqiLevelFromValue(worst.AQI),
      stationName: worst.StateCode ? `${worst.ReportingArea}, ${worst.StateCode}` : worst.ReportingArea
    }
  } catch {
    return null
  }
}
