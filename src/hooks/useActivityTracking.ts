import { useCallback, useEffect, useRef, useState } from 'react'
import type { Activity, ActivityPoint, ActivityType, AqiReading } from '../types'
import {
  appendPoint,
  discardActivity,
  getActiveActivity,
  listActivities,
  startActivity,
  stopActivity,
} from '../services/activityLog'

// Ignore GPS jitter smaller than this before logging a new point — phone
// GPS noise while standing still can otherwise add fake "distance."
const MIN_POINT_DISTANCE_METERS = 8

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function nearestAqi(lat: number, lng: number, readings: AqiReading[]): number | null {
  let best: { value: number; dist: number } | null = null
  for (const r of readings) {
    const dist = distanceMeters(lat, lng, r.lat, r.lng)
    if (!best || dist < best.dist) best = { value: r.value, dist }
  }
  return best ? best.value : null
}

/**
 * Foreground-only activity tracking. Browsers can't run geolocation while
 * a tab is closed or backgrounded for long — that's a real native-app-only
 * capability (see README "Roadmap"). This hook does the best available web
 * substitute: track while the tab is open, and auto-resume an in-progress
 * activity if the tab gets reloaded mid-run.
 */
export function useActivityTracking(aqiReadings: AqiReading[]) {
  const [active, setActive] = useState<Activity | null>(null)
  const [history, setHistory] = useState<Activity[]>([])
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [resumedNotice, setResumedNotice] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const lastPointRef = useRef<ActivityPoint | null>(null)
  // Kept in a ref (not state) so the geolocation callback below always
  // reads the latest AQI data without needing to re-subscribe watchPosition
  // every time aqiReadings changes.
  const readingsRef = useRef<AqiReading[]>(aqiReadings)

  useEffect(() => {
    readingsRef.current = aqiReadings
  }, [aqiReadings])

  const refreshHistory = useCallback(() => {
    setHistory(listActivities().filter((a) => a.status !== 'active'))
  }, [])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const beginWatch = useCallback((activityId: string) => {
    if (!('geolocation' in navigator)) {
      setPermissionError("This browser doesn't support location tracking.")
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const last = lastPointRef.current

        if (
          last &&
          distanceMeters(last.lat, last.lng, latitude, longitude) < MIN_POINT_DISTANCE_METERS
        ) {
          return
        }

        const point: ActivityPoint = {
          lat: latitude,
          lng: longitude,
          timestamp: Date.now(),
          nearestAqi: nearestAqi(latitude, longitude, readingsRef.current),
        }

        lastPointRef.current = point
        const updated = appendPoint(activityId, point)
        if (updated) setActive(updated)
      },
      (error) => {
        setPermissionError(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Enable it in your browser settings to track activities.'
            : 'Unable to get your location right now.'
        )
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [])

  useEffect(() => {
    const existing = getActiveActivity()
    if (existing) {
      setActive(existing)
      lastPointRef.current = existing.points[existing.points.length - 1] ?? null
      setResumedNotice(true)
      beginWatch(existing.id)
    }
    refreshHistory()

    return () => {
      stopWatch()
    }
    // Intentionally runs once on mount only — beginWatch/refreshHistory/
    // stopWatch are stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(
    (type: ActivityType) => {
      setPermissionError(null)
      setResumedNotice(false)
      const activity = startActivity(type)
      lastPointRef.current = null
      setActive(activity)
      beginWatch(activity.id)
    },
    [beginWatch]
  )

  const stop = useCallback(() => {
    if (!active) return
    stopWatch()
    const finished = stopActivity(active.id)
    setActive(null)
    lastPointRef.current = null
    if (finished) refreshHistory()
  }, [active, stopWatch, refreshHistory])

  const discard = useCallback(() => {
    if (!active) return
    stopWatch()
    discardActivity(active.id)
    setActive(null)
    lastPointRef.current = null
  }, [active, stopWatch])

  return {
    active,
    history,
    permissionError,
    resumedNotice,
    start,
    stop,
    discard,
    refreshHistory,
  }
}

export type ActivityTracking = ReturnType<typeof useActivityTracking>
