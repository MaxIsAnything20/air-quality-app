import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { AqiReading } from '../types'
import { aqiLevelFromValue } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'
import { fetchRoute, type RouteProfile, type RouteResult } from '../services/routes'
import { buildRouteAqiSegments } from '../services/routeAir'
import { useTurnByTurnNavigation, type LatLng } from '../hooks/useTurnByTurnNavigation'
import { instructionForStep, maneuverIcon, type ManeuverIcon } from '../services/navigationInstructions'

interface NavigationViewProps {
  initialRoute: RouteResult
  destination: LatLng
  profile: RouteProfile
  aqiReadings: AqiReading[]
  onExit: () => void
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  if (km < 0.1) return `${Math.round(meters)} m`
  return `${km.toFixed(km < 10 ? 2 : 1)} km`
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60))
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

// One base arrow, rotated per maneuver — covers OSRM's whole modifier
// vocabulary without needing a full icon set. Roundabout/arrive get their
// own glyphs since "rotate an arrow" doesn't read as either of those.
const ARROW_ROTATION: Record<ManeuverIcon, number> = {
  straight: 0,
  'slight-right': 35,
  right: 90,
  'sharp-right': 135,
  uturn: 180,
  'sharp-left': -135,
  left: -90,
  'slight-left': -35,
  depart: 0,
  roundabout: 0,
  arrive: 0
}

function ManeuverIconGlyph({ icon }: { icon: ManeuverIcon }) {
  if (icon === 'arrive') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )
  }
  if (icon === 'roundabout') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2v6M20 12h-4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      style={{ transform: `rotate(${ARROW_ROTATION[icon]}deg)` }}
    >
      <path d="M12 20V4M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RecenterOnLive({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true })
  }, [position, map])
  return null
}

/**
 * Full-screen turn-by-turn navigation, launched from RoutePlanningView
 * once a real (non-sample) route is planned — see useTurnByTurnNavigation
 * for the live-tracking/voice logic this renders. Mirrors ActivityView's
 * existing full-screen-map overlay pattern (absolute inset-0 z-50 within
 * the app's phone-frame container in App.tsx).
 */
export default function NavigationView({
  initialRoute,
  destination,
  profile,
  aqiReadings,
  onExit
}: NavigationViewProps) {
  const [route, setRoute] = useState(initialRoute)
  const [recalculating, setRecalculating] = useState(false)
  const nav = useTurnByTurnNavigation(route, aqiReadings)

  const segments = buildRouteAqiSegments(route.coordinates, aqiReadings)

  async function handleRecalculate() {
    if (!nav.position || recalculating) return
    setRecalculating(true)
    try {
      const fresh = await fetchRoute(nav.position, destination, profile)
      setRoute(fresh)
    } catch {
      // Best effort — stay on the existing route if recalculation fails,
      // rather than leaving the screen in a broken state.
    } finally {
      setRecalculating(false)
    }
  }

  if (nav.arrived) {
    return (
      <div className="absolute inset-0 z-50 bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] flex flex-col items-center justify-center text-white px-6 text-center">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <p className="text-lg font-semibold mt-4 mb-1">You've arrived</p>
        <p className="text-sm text-white/80 mb-6">Navigation complete.</p>
        <button onClick={onExit} className="px-6 py-3 rounded-xl bg-white text-[#1F4D3A] text-sm font-semibold">
          Done
        </button>
      </div>
    )
  }

  const currentStep = nav.currentStep
  const icon = currentStep ? maneuverIcon(currentStep) : 'straight'
  const instructionText = currentStep
    ? instructionForStep(currentStep, nav.stepIndex === nav.steps.length - 1)
    : 'Calculating…'

  return (
    <div className="absolute inset-0 z-50 bg-white dark:bg-night-900 flex flex-col">
      <div className="bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] px-4 pt-4 pb-3.5 flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <ManeuverIconGlyph icon={icon} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-base font-semibold m-0 truncate">{instructionText}</p>
          {nav.distanceToManeuver != null && (
            <p className="text-white/70 text-xs m-0 mt-0.5">{formatDistance(nav.distanceToManeuver)}</p>
          )}
        </div>
        <button
          onClick={onExit}
          aria-label="Exit navigation"
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {nav.offRoute && (
        <div className="bg-[#D9922B]/15 border-b border-[#D9922B]/30 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-900 dark:text-night-100 m-0">Looks like you're off the planned route.</p>
          <button
            onClick={handleRecalculate}
            disabled={recalculating || !nav.position}
            className="text-xs font-semibold text-[#1F4D3A] dark:text-[#8FC7A6] underline shrink-0 disabled:opacity-50"
          >
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </button>
        </div>
      )}

      {nav.permissionError && (
        <div className="bg-aqi-unhealthy/10 border-b border-aqi-unhealthy/30 px-4 py-2">
          <p className="text-xs text-ink-900 dark:text-night-100 m-0">{nav.permissionError}</p>
        </div>
      )}

      <div className="flex-1 relative">
        <MapContainer
          center={nav.position ? [nav.position.lat, nav.position.lng] : route.coordinates[0]}
          zoom={17}
          className="h-full w-full"
          zoomControl={false}
        >
          {nav.position && <RecenterOnLive position={[nav.position.lat, nav.position.lng]} />}
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {segments.length > 0 ? (
            segments.map((segment, index) => (
              <Polyline
                key={index}
                positions={segment.coordinates}
                pathOptions={{ color: aqiColor[segment.level], weight: 5 }}
              />
            ))
          ) : (
            <Polyline positions={route.coordinates} pathOptions={{ color: '#1F4D3A', weight: 5 }} />
          )}
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={7}
            pathOptions={{ color: '#C24545', fillColor: '#C24545', fillOpacity: 1 }}
          />
          {nav.position && (
            <CircleMarker
              center={[nav.position.lat, nav.position.lng]}
              radius={8}
              pathOptions={{ color: '#1F4D3A', fillColor: '#3B82F6', fillOpacity: 1, weight: 3 }}
            />
          )}
        </MapContainer>

        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => nav.setVoiceEnabled(!nav.voiceEnabled)}
            aria-label={nav.voiceEnabled ? 'Mute voice guidance' : 'Enable voice guidance'}
            className="w-9 h-9 rounded-full bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
          >
            {nav.voiceEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5ZM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5ZM23 9l-6 6M17 9l6 6" />
              </svg>
            )}
          </button>
        </div>

        {nav.currentAqi != null && (
          <div className="absolute top-3 left-3 z-[1000]">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full text-white shadow"
              style={{ backgroundColor: aqiColor[aqiLevelFromValue(nav.currentAqi)] }}
            >
              {nav.currentAqi} · {aqiLevelLabel[aqiLevelFromValue(nav.currentAqi)]}
            </span>
          </div>
        )}

        {!nav.voiceSupported && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000]">
            <p className="text-[10px] text-center text-white bg-black/50 rounded-full px-3 py-1 m-0">
              Voice guidance isn't supported in this browser — instructions are shown on screen instead.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-ink-200 dark:border-night-600 px-4 py-3 bg-white dark:bg-night-900 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-400 dark:text-night-400 m-0">Remaining</p>
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">
            {formatDistance(nav.distanceRemaining ?? route.distanceMeters)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400 dark:text-night-400 m-0">ETA</p>
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">
            {formatDuration(nav.durationRemaining ?? route.durationSeconds)}
          </p>
        </div>
      </div>
    </div>
  )
}
