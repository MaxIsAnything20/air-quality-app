import { useEffect, useState } from 'react'
import { AqiReading, ConditionAlert, DailyExposure, ExposureStats, FieldReport, PurpleAirReading, SmokePolygon, aqiLevelFromValue } from '../types'
import { fetchCurrentObservations, fetchForecast, fetchRegionalForecast, fetchRegionalObservations, formatObservedAt, worstReading, buildPollutantBreakdown } from '../services/airnow'
import { fetchSmokePolygons } from '../services/smoke'
import { fetchFireReports } from '../services/fire'
import { boundingBoxAround, fetchPurpleAirSensors } from '../services/purpleair'
import { ApiNotConfiguredError } from '../services/apiError'
import { getCurrentCoords, Coords } from '../services/geolocation'
import { buildConditionAlert } from '../services/conditionAlert'
import { getDaysUnhealthyThisMonth, getMonthlyHistory, recordDailyReading } from '../services/historyLog'
import { getMapSnapshot, listPastSnapshotDates, recordMapSnapshot } from '../services/mapSnapshotLog'
import {
  generateMockMonthlyHistory,
  mockAqiReadings,
  mockConditionAlert,
  mockExposureStats,
  mockFieldReports,
  mockPurpleAirReadings,
  mockSmokePolygons
} from '../data/mockData'

interface AirQualityState {
  status: 'loading' | 'ready' | 'error'
  usingSampleData: boolean
  errorMessage?: string
  center: [number, number]
  aqiReadings: AqiReading[]
  stats: ExposureStats
  alert: ConditionAlert
  // Real history, logged client-side as live readings come in (see
  // services/historyLog.ts) — falls back to a fabricated sample curve only
  // until enough real days have accumulated for this browser/device. Kept
  // out of `usingSampleData` on purpose: that flag drives the "live AirNow
  // failed" banner, and a thin real history isn't an error state.
  monthlyHistory: DailyExposure[]
  historyUsingSampleData: boolean
  // Real AirNow regional forecast — backs the time slider's "Tomorrow" step.
  // Empty (not sample data) if the forecast call fails; the slider just
  // won't offer that step rather than show something invented.
  tomorrowAqiReadings: AqiReading[]
}

interface SmokeState {
  smokePolygons: SmokePolygon[]
  smokeUsingSampleData: boolean
}

// Fire (point) reports, kept separate from AQI/smoke for the same reason
// smoke is separate from AQI: independent NOAA source, own failure mode.
// The mock "smoke" kind report (a plain-language plume note, distinct from
// the smoke polygon layer) is still folded in here until that has its own
// real source too.
interface FireState {
  fireReports: FieldReport[]
  fireUsingSampleData: boolean
}

// PurpleAir sensors: independent source again, own key, own failure mode
// (including "no key configured at all," which is the likely default here
// since it's a separate signup from AirNow's).
interface PurpleAirState {
  purpleAirReadings: PurpleAirReading[]
  purpleAirUsingSampleData: boolean
  purpleAirMissingKey: boolean
}

const FALLBACK_CENTER: [number, number] = [37.7749, -122.4194]

/** Shifts a lat/lng by the offset between `center` and FALLBACK_CENTER —
 *  the mock data in data/mockData.ts (AQI stations, PurpleAir sensors) is
 *  all anchored near FALLBACK_CENTER (SF), so this re-centers it near
 *  wherever the app is actually looking instead of always showing dots in
 *  San Francisco regardless of the real/searched location. */
function shiftToCenter<T extends { lat: number; lng: number }>(items: T[], center: [number, number]): T[] {
  const [deltaLat, deltaLng] = [center[0] - FALLBACK_CENTER[0], center[1] - FALLBACK_CENTER[1]]
  return items.map((item) => ({ ...item, lat: item.lat + deltaLat, lng: item.lng + deltaLng }))
}

function sampleState(errorMessage?: string, center: [number, number] = FALLBACK_CENTER): AirQualityState {
  return {
    status: 'error',
    usingSampleData: true,
    errorMessage,
    center,
    aqiReadings: shiftToCenter(mockAqiReadings, center),
    stats: mockExposureStats,
    alert: mockConditionAlert,
    monthlyHistory: generateMockMonthlyHistory(),
    historyUsingSampleData: true,
    tomorrowAqiReadings: []
  }
}

/** Real logged history if there's any for this month yet, else the
 *  fabricated sample curve — so the History tab always has something to
 *  render instead of an empty chart on a brand-new device. */
function historyOrSample(): { monthlyHistory: DailyExposure[]; historyUsingSampleData: boolean } {
  const real = getMonthlyHistory()
  if (real.length > 0) return { monthlyHistory: real, historyUsingSampleData: false }
  return { monthlyHistory: generateMockMonthlyHistory(), historyUsingSampleData: true }
}

export function useAirQuality() {
  const [state, setState] = useState<AirQualityState>({ ...sampleState(), status: 'loading' })
  // Kept separate from `state`: the smoke feed is an independent NOAA source
  // with no API key and its own failure modes, so a smoke outage shouldn't
  // flip the whole app into "sample data" mode for AirNow's AQI readings too.
  const [smoke, setSmoke] = useState<SmokeState>({
    smokePolygons: mockSmokePolygons,
    smokeUsingSampleData: true
  })
  const [fire, setFire] = useState<FireState>({
    fireReports: mockFieldReports.filter((r) => r.kind === 'fire'),
    fireUsingSampleData: true
  })
  const [purpleAir, setPurpleAir] = useState<PurpleAirState>({
    purpleAirReadings: mockPurpleAirReadings,
    purpleAirUsingSampleData: true,
    purpleAirMissingKey: true
  })
  // Set when the user picks a search result — overrides browser geolocation
  // for both the AQI fetch and the fire feed below. `label` is kept so the
  // search bar can show what's currently selected instead of raw coordinates.
  const [locationOverride, setLocationOverride] = useState<(Coords & { label: string }) | null>(
    null
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const coords = locationOverride ?? (await getCurrentCoords())
        const [observations, forecast, regionalReadings, regionalForecastResult] = await Promise.all([
          fetchCurrentObservations(coords.lat, coords.lng),
          fetchForecast(coords.lat, coords.lng),
          fetchRegionalObservations(coords.lat, coords.lng),
          // Own try/catch — a forecast hiccup shouldn't fail the whole
          // current-conditions fetch, it should just mean no "Tomorrow" step.
          fetchRegionalForecast(coords.lat, coords.lng).catch((err) => {
            console.warn('Regional forecast fetch failed:', err)
            return [] as AqiReading[]
          })
        ])

        const currentWorst = worstReading(observations)
        if (!currentWorst) {
          throw new Error('No AirNow monitoring stations reporting near this location.')
        }
        const forecastWorst = worstReading(forecast)

        const reading: AqiReading = {
          value: currentWorst.AQI,
          level: aqiLevelFromValue(currentWorst.AQI),
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters: 6000,
          stationName: currentWorst.StateCode
            ? `${currentWorst.ReportingArea}, ${currentWorst.StateCode}`
            : currentWorst.ReportingArea,
          pollutant: currentWorst.ParameterName,
          observedAt: formatObservedAt(currentWorst.DateObserved, currentWorst.HourObserved, currentWorst.LocalTimeZone),
          pollutants: buildPollutantBreakdown(observations, currentWorst)
        }

        // Log today's reading to the rolling history before anything else —
        // this is what backs the History tab's real data (see
        // services/historyLog.ts) instead of AirNow's historical endpoint,
        // which only returns one day/area per call.
        recordDailyReading(currentWorst.AQI)
        const history = historyOrSample()

        const stats: ExposureStats = {
          currentAqi: currentWorst.AQI,
          daysUnhealthyThisMonth: history.historyUsingSampleData
            ? mockExposureStats.daysUnhealthyThisMonth
            : getDaysUnhealthyThisMonth(),
          forecastPeakAqi: forecastWorst?.AQI ?? currentWorst.AQI
        }

        if (!cancelled) {
          setState({
            status: 'ready',
            usingSampleData: false,
            center: [coords.lat, coords.lng],
            // Regional grid shows real spatial variety (good/moderate/etc
            // areas next to each other), same idea as AirNow's own map.
            // Falls back to the single nearest-station reading if the grid
            // fetch came back empty for some reason.
            aqiReadings: regionalReadings.length > 0 ? regionalReadings : [reading],
            stats,
            alert: buildConditionAlert(currentWorst, forecastWorst),
            tomorrowAqiReadings: regionalForecastResult,
            ...history
          })
        }
      } catch (err) {
        if (!cancelled) {
          const fallbackCenter: [number, number] = locationOverride
            ? [locationOverride.lat, locationOverride.lng]
            : FALLBACK_CENTER
          setState(sampleState(err instanceof Error ? err.message : 'Unknown error', fallbackCenter))
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [locationOverride])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const polygons = await fetchSmokePolygons()
        // An empty feed is a valid "no smoke today" result, not a failure.
        if (!cancelled) setSmoke({ smokePolygons: polygons, smokeUsingSampleData: false })
      } catch (err) {
        console.warn('NOAA smoke feed fetch failed, using sample data:', err)
        if (!cancelled) setSmoke({ smokePolygons: mockSmokePolygons, smokeUsingSampleData: true })
      }
    }

    run()
    const interval = setInterval(run, 15 * 60 * 1000) // NOAA updates every few hours; 15 min is plenty
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const coords = locationOverride ?? (await getCurrentCoords())
        const reports = await fetchFireReports(coords)
        // An empty result is a valid "no fires nearby" result, not a failure.
        if (!cancelled) setFire({ fireReports: reports, fireUsingSampleData: false })
      } catch (err) {
        console.warn('NOAA fire feed fetch failed, using sample data:', err)
        if (!cancelled) {
          setFire({
            fireReports: mockFieldReports.filter((r) => r.kind === 'fire'),
            fireUsingSampleData: true
          })
        }
      }
    }

    run()
    const interval = setInterval(run, 15 * 60 * 1000) // NOAA updates every few hours; 15 min is plenty
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [locationOverride])

  useEffect(() => {
    let cancelled = false

    async function run() {
      // Resolved outside the try/catch on purpose: getCurrentCoords() never
      // actually rejects (it resolves to its own SF fallback internally —
      // see services/geolocation.ts), so this is safe, and it means coords
      // is still in scope in the catch block below to re-center the sample
      // sensors near the real/searched location rather than leaving `const
      // coords` scoped to a try block the catch can't see.
      const coords = locationOverride ?? (await getCurrentCoords())
      try {
        // Tighter radius than the fire feed on purpose — the whole point of
        // PurpleAir here is hyperlocal density, not wide-area coverage.
        const box = boundingBoxAround(coords.lat, coords.lng, 25)
        const readings = await fetchPurpleAirSensors(box)
        if (!cancelled) {
          setPurpleAir({ purpleAirReadings: readings, purpleAirUsingSampleData: false, purpleAirMissingKey: false })
        }
      } catch (err) {
        console.warn('PurpleAir fetch failed, using sample data:', err)
        if (!cancelled) {
          setPurpleAir({
            purpleAirReadings: shiftToCenter(mockPurpleAirReadings, [coords.lat, coords.lng]),
            purpleAirUsingSampleData: true,
            purpleAirMissingKey: err instanceof ApiNotConfiguredError
          })
        }
      }
    }

    run()
    const interval = setInterval(run, 5 * 60 * 1000) // PurpleAir sensors update every ~2 min; 5 min is plenty
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [locationOverride])

  // Records a map snapshot for today whenever AQI, smoke, and fire are all
  // genuinely live (not sample data) — this is what backs the time
  // slider's past-day steps. Runs once per successful refresh cycle across
  // all three sources, not on every render.
  useEffect(() => {
    if (state.usingSampleData || smoke.smokeUsingSampleData || fire.fireUsingSampleData) return
    recordMapSnapshot({
      aqiReadings: state.aqiReadings,
      smokePolygons: smoke.smokePolygons,
      fireReports: fire.fireReports
    })
  }, [state.usingSampleData, state.aqiReadings, smoke.smokeUsingSampleData, smoke.smokePolygons, fire.fireUsingSampleData, fire.fireReports])

  const fieldReports: FieldReport[] = [
    ...fire.fireReports,
    // Still mock — see FireState comment above.
    ...mockFieldReports.filter((r) => r.kind === 'smoke')
  ]

  return {
    ...state,
    ...smoke,
    ...purpleAir,
    fieldReports,
    fireUsingSampleData: fire.fireUsingSampleData,
    activeLocationLabel: locationOverride?.label ?? null,
    // Time slider support — real logged past days (oldest first) and a
    // lookup for any given date's snapshot. See services/mapSnapshotLog.ts.
    pastMapDates: listPastSnapshotDates(),
    getMapSnapshotForDate: getMapSnapshot,
    searchLocation: (coords: Coords, label: string) => {
      setLocationOverride({ ...coords, label })
      // Move the map right away instead of waiting on the AQI fetch —
      // the fetch effect above will fill in real readings once it resolves.
      setState((prev) => ({ ...prev, center: [coords.lat, coords.lng] }))
    },
    clearLocationOverride: () => setLocationOverride(null)
  }
}
