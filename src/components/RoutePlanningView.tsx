import { useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet'
import type { AqiReading } from '../types'
import { aqiLevelFromValue } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'
import ScreenHeader from './ScreenHeader'
import SearchBar from './SearchBar'
import type { PlaceResult } from '../services/geocode'
import { useRoutePlanning } from '../hooks/useRoutePlanning'
import type { RouteProfile } from '../services/routes'
import { FREE_ROUTE_PLAN_LIMIT } from '../services/routePlans'

interface RoutePlanningViewProps {
  onBack: () => void
  onUpgrade: () => void
  aqiReadings: AqiReading[]
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  return `${km.toFixed(km < 10 ? 2 : 1)} km`
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

function AqiPill({ aqi }: { aqi: number | null }) {
  if (aqi == null) {
    return <span className="text-xs text-ink-400 dark:text-night-400">No AQI data</span>
  }
  const level = aqiLevelFromValue(aqi)
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: aqiColor[level] }}
    >
      {aqi} · {aqiLevelLabel[level]}
    </span>
  )
}

/**
 * Real destination search (Nominatim, via SearchBar — no key needed) and
 * real device geolocation feed a route request to OpenRouteService (see
 * services/routes.ts). Until OPENROUTESERVICE_API_KEY is set server-side,
 * useRoutePlanning falls back to a clearly-labeled sample straight-line
 * route instead — this screen always shows that as a banner + dashed line,
 * never blending it in as if it were real turn-by-turn directions.
 */
export default function RoutePlanningView({ onBack, onUpgrade, aqiReadings }: RoutePlanningViewProps) {
  const { status, origin, destinationLabel, plan, errorMessage, planCount, freeLimitReached, planRouteTo, reset } =
    useRoutePlanning(aqiReadings)
  const [profile, setProfile] = useState<RouteProfile>('foot-walking')

  const busy = status === 'locating' || status === 'loading'

  function handleSelectDestination(result: PlaceResult) {
    planRouteTo({ lat: result.lat, lng: result.lng, label: result.label }, profile)
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Cleaner route" onBack={onBack} />

      <div className="px-4 pt-4 pb-6">
        <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
          Search a destination to see the air quality along the way, based on your current location and the
          nearest real AQI readings.
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setProfile('foot-walking')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${
              profile === 'foot-walking'
                ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900'
                : 'bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100'
            }`}
          >
            Walk
          </button>
          <button
            onClick={() => setProfile('cycling-regular')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${
              profile === 'cycling-regular'
                ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900'
                : 'bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100'
            }`}
          >
            Cycle
          </button>
        </div>

        <div className="rounded-lg border border-ink-200 dark:border-night-600 mb-4 overflow-hidden">
          <SearchBar onSelectLocation={handleSelectDestination} activeLabel={destinationLabel} onClear={reset} />
        </div>

        {busy && (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">
            {status === 'locating' ? 'Getting your location…' : 'Planning your route…'}
          </p>
        )}

        {status === 'error' && errorMessage && (
          <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3 mb-4">
            <p className="text-xs text-ink-900 dark:text-night-100 m-0">{errorMessage}</p>
            {freeLimitReached && (
              <button
                onClick={onUpgrade}
                className="text-xs font-medium text-[#1F4D3A] dark:text-[#8FC7A6] underline mt-2"
              >
                Upgrade for unlimited route plans
              </button>
            )}
          </div>
        )}

        {plan && status === 'ready' && (
          <div className="space-y-3">
            {plan.usingSampleData && (
              <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-2.5">
                <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
                  Sample route preview — real turn-by-turn directions need an OpenRouteService API key set on
                  the server. Distance shown is accurate (straight-line); duration is a rough pace estimate,
                  not real routing.
                </p>
              </div>
            )}

            <div className="h-48 rounded-xl overflow-hidden border border-ink-200 dark:border-night-600">
              <MapContainer
                center={plan.route.coordinates[Math.floor(plan.route.coordinates.length / 2)]}
                zoom={13}
                className="h-full w-full"
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline
                  positions={plan.route.coordinates}
                  pathOptions={{
                    color: '#1F4D3A',
                    weight: 4,
                    dashArray: plan.usingSampleData ? '6 6' : undefined
                  }}
                />
                {origin && (
                  <CircleMarker
                    center={[origin.lat, origin.lng]}
                    radius={6}
                    pathOptions={{ color: '#1F4D3A', fillColor: '#1F4D3A', fillOpacity: 1 }}
                  />
                )}
                <CircleMarker
                  center={plan.route.coordinates[plan.route.coordinates.length - 1]}
                  radius={6}
                  pathOptions={{ color: '#C24545', fillColor: '#C24545', fillOpacity: 1 }}
                />
              </MapContainer>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
                <p className="text-xs text-ink-600 dark:text-night-200 m-0">Distance</p>
                <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">
                  {formatDistance(plan.route.distanceMeters)}
                </p>
              </div>
              <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
                <p className="text-xs text-ink-600 dark:text-night-200 m-0">
                  {plan.usingSampleData ? 'Est. duration' : 'Duration'}
                </p>
                <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">
                  {formatDuration(plan.route.durationSeconds)}
                </p>
              </div>
            </div>

            {plan.usingSampleData ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-ink-600 dark:text-night-200 m-0 mb-1">Near start</p>
                  <AqiPill aqi={plan.originAqi} />
                </div>
                <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-ink-600 dark:text-night-200 m-0 mb-1">Near destination</p>
                  <AqiPill aqi={plan.destinationAqi} />
                </div>
              </div>
            ) : (
              <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <p className="text-xs text-ink-600 dark:text-night-200 m-0">Avg AQI along route</p>
                <AqiPill aqi={plan.routeAvgAqi} />
              </div>
            )}

            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">
              {planCount} of {FREE_ROUTE_PLAN_LIMIT} free route plans used on this device.
            </p>

            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
            >
              Plan another route
            </button>
          </div>
        )}

        {status === 'idle' && (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">
            Search a destination above to plan a route.
          </p>
        )}
      </div>
    </div>
  )
}
