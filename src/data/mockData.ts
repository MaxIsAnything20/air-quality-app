import { AqiReading, ConditionAlert, DailyExposure, ExposureStats, FieldReport, PurpleAirReading, SmokePolygon, aqiLevelFromValue } from '../types'

// AQI readings are live now (services/airnow.ts). This is only the
// fallback shown if that call fails for any reason — no key, rate limit,
// no station nearby, offline.
//
// stationName is deliberately NOT a real place name: useAirQuality.ts's
// sampleState() re-centers these readings' lat/lng near wherever the app
// is actually looking (the user's real or searched location), which could
// be anywhere — a hardcoded "San Francisco, CA" would then sit on a dot
// nowhere near San Francisco and mislead anyone who taps it, especially in
// the per-region AI summary, which would state it as fact. "Sample
// Station" makes clear this is placeholder data no matter where it's
// been shifted to.
export const mockAqiReadings: AqiReading[] = [
  {
    value: 62,
    level: 'moderate',
    lat: 37.79,
    lng: -122.42,
    radiusMeters: 6000,
    stationName: 'Sample Station A (demo data)',
    pollutant: 'PM2.5',
    observedAt: 'Sample data — no live timestamp',
    pollutants: [
      { parameter: 'PM2.5', aqi: 62, level: 'moderate' },
      { parameter: 'OZONE', aqi: 38, level: 'good' }
    ]
  },
  {
    value: 128,
    level: 'sensitive',
    lat: 37.83,
    lng: -122.36,
    radiusMeters: 3500,
    stationName: 'Sample Station B (demo data)',
    pollutant: 'PM2.5',
    observedAt: 'Sample data — no live timestamp',
    pollutants: [
      { parameter: 'PM2.5', aqi: 128, level: 'sensitive' },
      { parameter: 'OZONE', aqi: 71, level: 'moderate' }
    ]
  },
  {
    value: 34,
    level: 'good',
    lat: 37.75,
    lng: -122.48,
    radiusMeters: 1200,
    stationName: 'Sample Station C (demo data)',
    pollutant: 'OZONE',
    observedAt: 'Sample data — no live timestamp',
    pollutants: [{ parameter: 'OZONE', aqi: 34, level: 'good' }]
  }
]

// NOAA HMS smoke polygons ship as vector data (light/medium/heavy density),
// fetched live via services/smoke.ts. This is the fallback shown if that
// feed is unreachable — network down, NOAA outage, etc.
export const mockSmokePolygons: SmokePolygon[] = [
  {
    id: 'sample-1',
    density: 'medium',
    densityValue: 16,
    startTime: null,
    endTime: null,
    satellite: null,
    coordinates: [
      [-122.6, 37.5],
      [-122.1, 37.5],
      [-122.1, 37.95],
      [-122.6, 37.95],
      [-122.6, 37.5]
    ]
  },
  {
    id: 'sample-2',
    density: 'light',
    densityValue: 5,
    startTime: null,
    endTime: null,
    satellite: null,
    coordinates: [
      [-120.5, 38.8],
      [-119.8, 38.8],
      [-119.8, 39.4],
      [-120.5, 39.4],
      [-120.5, 38.8]
    ]
  }
]

// Fire points are now live (services/fire.ts + fireKml.ts). This is only
// used as the fallback shown if that feed is unreachable, plus the
// still-mock "smoke" kind report (a plain-language plume note, distinct
// from the smoke polygon layer above).
export const mockFieldReports: FieldReport[] = [
  {
    id: 'r1',
    kind: 'fire',
    title: 'Ridge fire, 12 mi northeast',
    updatedMinutesAgo: 20,
    lat: 37.86,
    lng: -122.3
  },
  {
    id: 'r2',
    kind: 'smoke',
    title: 'Smoke plume drifting south',
    updatedMinutesAgo: 60,
    lat: 37.8,
    lng: -122.38
  }
]

// PurpleAir's crowdsourced sensors sit much denser than AirNow's official
// network — this fallback is deliberately more numerous and more scattered
// than mockAqiReadings above to represent that. See services/purpleair.ts.
// Anchored near FALLBACK_CENTER (SF), same as mockAqiReadings — shifted to
// sit near the real/searched location by useAirQuality.ts before use, so
// names are deliberately generic rather than real SF neighborhoods (see
// mockAqiReadings' comment above for why: a real place name would mislead
// once the dot is repositioned somewhere else entirely).
export const mockPurpleAirReadings: PurpleAirReading[] = [
  { id: 1001, name: 'Sample Sensor A (demo data)', lat: 37.762, lng: -122.494, pm25: 14.2, aqi: 58, level: 'moderate', updatedMinutesAgo: 4 },
  { id: 1002, name: 'Sample Sensor B (demo data)', lat: 37.744, lng: -122.415, pm25: 9.8, aqi: 51, level: 'moderate', updatedMinutesAgo: 6 },
  { id: 1003, name: 'Sample Sensor C (demo data)', lat: 37.78, lng: -122.49, pm25: 42.5, aqi: 119, level: 'sensitive', updatedMinutesAgo: 3 },
  { id: 1004, name: 'Sample Sensor D (demo data)', lat: 37.825, lng: -122.235, pm25: 6.1, aqi: 34, level: 'good', updatedMinutesAgo: 9 },
  { id: 1005, name: 'Sample Sensor E (demo data)', lat: 37.759, lng: -122.42, pm25: 21.4, aqi: 71, level: 'moderate', updatedMinutesAgo: 2 }
]

export const mockExposureStats: ExposureStats = {
  currentAqi: 62,
  daysUnhealthyThisMonth: 4,
  forecastPeakAqi: 118
}

export const mockConditionAlert: ConditionAlert = {
  level: 'moderate',
  headline: 'Moderate air quality nearby',
  detail: 'Smoke likely to reach your area by tomorrow afternoon.'
}

// Real history is now logged client-side as live readings come in (see
// services/historyLog.ts) — AirNow's historical endpoint only returns one
// day/reporting-area per call, so a rolling log was the practical option.
// This generator is only the fallback shown until a device has accumulated
// enough real logged days: a plausible month-to-date curve (a calm start,
// a multi-day smoke spike mid-month, tapering back down).
export function generateMockMonthlyHistory(): DailyExposure[] {
  const now = new Date()
  const daysSoFar = now.getDate()
  const base = [42, 38, 45, 51, 58, 90, 142, 168, 155, 121, 88, 60, 47, 40]

  return Array.from({ length: daysSoFar }, (_, i) => {
    const day = i + 1
    const aqi = base[i % base.length] + ((i * 7) % 11) - 5
    const clamped = Math.max(12, Math.min(220, aqi))
    const date = new Date(now.getFullYear(), now.getMonth(), day)
    return {
      date: date.toISOString().slice(0, 10),
      aqi: clamped,
      level: aqiLevelFromValue(clamped)
    }
  })
}
