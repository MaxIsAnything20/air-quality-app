import { useEffect, useMemo, useRef, useState } from 'react'
import type { AqiReading } from '../types'
import type { NavigationStep, RouteResult } from '../services/routes'
import { distanceMeters, nearestAqiReading } from '../services/routeAir'
import { formatAnnounceDistance, instructionForStep } from '../services/navigationInstructions'

export interface LatLng {
  lat: number
  lng: number
}

// Once within this many meters of a maneuver's own location, treat it as
// reached -- GPS noise means point-for-point equality would never fire.
const ARRIVAL_RADIUS_METERS = 25
// If the live position drifts further than this from the nearest point on
// the planned route's own geometry, treat the trip as having left the
// route (offering "Recalculate" in NavigationView) rather than silently
// continuing to guide toward a path that's no longer being followed.
const OFF_ROUTE_METERS = 70
// How far out (in meters) the upcoming-turn voice announcement fires --
// announced once per step, not on every position update.
const ANNOUNCE_LEAD_METERS = 150

function nearestDistanceToRoute(point: LatLng, coordinates: [number, number][]): number {
  let best = Infinity
  for (const [lat, lng] of coordinates) {
    const d = distanceMeters(point, { lat, lng })
    if (d < best) best = d
  }
  return best
}

/**
 * Drives live foreground turn-by-turn guidance for NavigationView -- takes
 * the already-planned route (see useRoutePlanning/services/routes.ts) and
 * a live watchPosition feed, and turns them into "which step are we on,
 * how far to the next maneuver, have we arrived, have we drifted off the
 * route" plus optional spoken guidance via the free, built-in Web Speech
 * API. Like useActivityTracking.ts, this only works while the browser tab
 * stays open and in the foreground -- browsers don't allow background
 * geolocation, so there's no way to keep guiding with the app closed or
 * the phone locked.
 */
export function useTurnByTurnNavigation(route: RouteResult, aqiReadings: AqiReading[]) {
  const [position, setPosition] = useState<LatLng | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [arrived, setArrived] = useState(false)
  const [offRoute, setOffRoute] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const steps = route.steps
  const announcedStepRef = useRef<number>(-1)

  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Reset all trip progress whenever a genuinely new route comes in (e.g.
  // after a Recalculate) rather than continuing to track against stale
  // step data.
  useEffect(() => {
    setStepIndex(0)
    setArrived(false)
    setOffRoute(false)
    announcedStepRef.current = -1
  }, [route])

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionError('Geolocation is not supported in this browser.')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPermissionError(null)
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setPermissionError('Location access was denied. Enable it in your browser settings to navigate.')
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const currentStep: NavigationStep | null = steps[stepIndex] ?? null

  // Off-route check -- recomputed on every live position update.
  useEffect(() => {
    if (!position || route.coordinates.length === 0) return
    const nearest = nearestDistanceToRoute(position, route.coordinates)
    setOffRoute(nearest > OFF_ROUTE_METERS)
  }, [position, route.coordinates])

  // Step-advancement + arrival detection -- recomputed on every live
  // position update.
  useEffect(() => {
    if (!position || !currentStep || arrived) return
    const d = distanceMeters(position, { lat: currentStep.location[0], lng: currentStep.location[1] })
    if (d <= ARRIVAL_RADIUS_METERS) {
      if (stepIndex >= steps.length - 1) {
        setArrived(true)
      } else {
        setStepIndex((i) => i + 1)
        announcedStepRef.current = -1
      }
    }
  }, [position, currentStep, stepIndex, steps.length, arrived])

  const distanceToManeuver = useMemo(() => {
    if (!position || !currentStep) return null
    return distanceMeters(position, { lat: currentStep.location[0], lng: currentStep.location[1] })
  }, [position, currentStep])

  // Voice announcement -- fires once per step, when within the lead
  // distance of its maneuver (or immediately for a step that's already
  // closer than the lead distance, e.g. right after advancing).
  useEffect(() => {
    if (!voiceEnabled || !voiceSupported || !currentStep) return
    if (distanceToManeuver == null) return
    if (distanceToManeuver > ANNOUNCE_LEAD_METERS) return
    if (announcedStepRef.current === stepIndex) return

    announcedStepRef.current = stepIndex
    const isLast = stepIndex === steps.length - 1
    const instruction = instructionForStep(currentStep, isLast)
    const utterance = new SpeechSynthesisUtterance(instruction)
    window.speechSynthesis.speak(utterance)
  }, [distanceToManeuver, currentStep, stepIndex, steps.length, voiceEnabled, voiceSupported])

  // Remaining distance/time -- the distance still to cover on the current
  // step (from the live position, not the step's own start) plus every
  // full step still ahead. Duration is scaled the same way, proportional
  // to each step's own distance/duration ratio.
  const distanceRemaining = useMemo(() => {
    if (!currentStep) return null
    let total = distanceToManeuver ?? currentStep.distanceMeters
    for (let i = stepIndex + 1; i < steps.length; i++) {
      total += steps[i].distanceMeters
    }
    return total
  }, [currentStep, distanceToManeuver, stepIndex, steps])

  const durationRemaining = useMemo(() => {
    if (!currentStep) return null
    const stepFraction =
      currentStep.distanceMeters > 0 && distanceToManeuver != null
        ? Math.min(1, distanceToManeuver / currentStep.distanceMeters)
        : 1
    let total = currentStep.durationSeconds * stepFraction
    for (let i = stepIndex + 1; i < steps.length; i++) {
      total += steps[i].durationSeconds
    }
    return total
  }, [currentStep, distanceToManeuver, stepIndex, steps])

  const currentAqi = useMemo(() => {
    if (!position) return null
    return nearestAqiReading(position, aqiReadings)?.value ?? null
  }, [position, aqiReadings])

  return {
    position,
    steps,
    stepIndex,
    currentStep,
    distanceToManeuver,
    distanceRemaining,
    durationRemaining,
    arrived,
    offRoute,
    permissionError,
    voiceEnabled,
    voiceSupported,
    setVoiceEnabled,
    currentAqi
  }
}
}
