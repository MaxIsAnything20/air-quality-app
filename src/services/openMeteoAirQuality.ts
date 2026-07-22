import { PollutantReading, aqiLevelFromValue } from '../types'

/**
 * Full 5-pollutant AQI breakdown (PM2.5, PM10, NO2, O3, SO2, plus CO),
 * sourced from Open-Meteo's free, keyless Air Quality API
 * (https://open-meteo.com/en/docs/air-quality-api) rather than AirNow.
 *
 * Why a second source: AirNow reports whichever pollutants a physical
 * station near you actually measures — most US stations only report
 * PM2.5 and ozone, so NO2/SO2/PM10 are usually missing entirely (see
 * AqiReading.pollutants in types.ts, built in airnow.ts). Open-Meteo
 * fills that gap with a global CAMS-based model that always returns all
 * six pollutants for any coordinate, no station required. It's a model
 * estimate rather than a direct sensor reading, so this is presented as
 * a clearly-labeled supplement to AirNow's real station data, not a
 * replacement for it.
 */
export interface FullPollutantBreakdown {
  source: 'open-meteo'
  /** ISO-ish timestamp string as returned by Open-Meteo, e.g. "2026-07-22T12:00". */
  observedAt: string
  /** Worst pollutant first, same ordering convention as AqiReading.pollutants. */
  pollutants: PollutantReading[]
}

const ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// Open-Meteo's US AQI parameter names -> the short label this app already
// uses elsewhere for pollutant badges (see SummaryCard.tsx / airnow.ts).
const PARAM_LABELS: Record<string, string> = {
  us_aqi_pm2_5: 'PM2.5',
  us_aqi_pm10: 'PM10',
  us_aqi_nitrogen_dioxide: 'NO2',
  us_aqi_ozone: 'OZONE',
  us_aqi_sulphur_dioxide: 'SO2',
  us_aqi_carbon_monoxide: 'CO'
}

/** Fetches the full pollutant breakdown for a coordinate. Never throws —
 * returns null on any network/parse failure so callers can just hide the
 * section, matching this app's "never just breaks" fallback pattern used
 * everywhere else (AirNow, PurpleAir, smoke/fire, Gemini summary). */
export async function fetchFullPollutantBreakdown(
  lat: number,
  lng: number
): Promise<FullPollutantBreakdown | null> {
  try {
    const params = Object.keys(PARAM_LABELS).join(',')
    const url = `${ENDPOINT}?latitude=${lat}&longitude=${lng}&current=${params}&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) return null

    const json = await res.json()
    const current = json?.current
    if (!current) return null

    const pollutants: PollutantReading[] = Object.entries(PARAM_LABELS)
      .map(([key, parameter]) => {
        const aqi = current[key]
        if (typeof aqi !== 'number' || Number.isNaN(aqi)) return null
        const rounded = Math.round(aqi)
        return { parameter, aqi: rounded, level: aqiLevelFromValue(rounded) }
      })
      .filter((p): p is PollutantReading => p !== null)
      .sort((a, b) => b.aqi - a.aqi)

    if (pollutants.length === 0) return null

    return { source: 'open-meteo', observedAt: current.time ?? '', pollutants }
  } catch {
    return null
  }
}
