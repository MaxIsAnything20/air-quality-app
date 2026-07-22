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
import { FREE_ROUTE_PLAN_LIMIT, UNLIMITED_ROUTE_PLANS } from '../services/routePlans'

interface RoutePlanningViewProps {
  onBack: () => void
  onUpgrade: () => void
  aqiReadings: AqiReading[]
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  if (km < 0.1) return `${Math.round(meters)} m`
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
 * A senior-engineer-style, honest usage counter — shown before the user
 * even searches (not just after they hit the wall), so the limit is
 * never a surprise buried in an error message. Once free plans run out,
 * this becomes the primary call-to-action for upgrading rather than a
 * secondary link inside an error card.
 *
 * While UNLIMITED_ROUTE_PLANS is on (services/routePlans.ts), this shows
 * honest "unlimited, temporary" copy instead of a fake declining count —
 * never claiming a limit is being enforced when it isn't.
 */
function RemainingPlansNotice({ planCount, onUpgrade }: { planCount: number; onUpgrade: () => void }) {
  if (UNLIMITED_ROUTE_PLANS) {
    return (
      <p className="text-[11px] text-ink-400 dark:text-night-400 text-center mb-4 m-0">
        Unlimited route plans (temporary)
      </p>
    )
  }

  const remaining = Math.max(0, FREE_ROUTE_PLAN_LIMIT - planCount)

  if (remaining === 0) {
    return (
      <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-900 dark:text-night-100 m-0">
          No free route plans remaining on this device.
        </p>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold text-[#1F4D3A] dark:text-[#8FC7A6] underline shrink-0"
        >
          Upgrade
        </button>
      </div>
    )
  }

  return (
    <p className="text-[11px] text-ink-400 dark:text-night-400 text-center mb-4 m-0">
      {remaining} free route plan{remaining === 1 ? '' : 's'} remaining
    </p>
  )
}

/**
 * A distinct "this trip isn't possible" card — separate from the generic
 * error card below, since this isn't a bug or a network hiccup, it's a
 * real finding about the two chosen points (either too far apart for the
 * chosen activity, or not connected by any road/trail OpenRouteService
 * knows about). See useRoutePlanning's planRoute for both checks.
 */
function InfeasibleRouteNotice({ reason }: { reason: string }) {
  return (
    <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3 mb-4 flex gap-2.5">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-aqi-unhealthy shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
      </svg>
      <div>
        <p className="text-xs font-semibold text-ink-900 dark:text-night-100 m-0">Route not possible</p>
        <p className="text-xs text-ink-600 dark:text-night-200 mt-1 mb-0">{reason}</p>
      </div>
    </div>
  )
}

/**
 * Real destination search (Photon, via SearchBar — no key needed) for
 * both Start and End, real device geolocation as a one-tap alternative
 * for Start, feeding a route request to OpenRouteService (see
 * services/routes.ts). Until OPENROUTESERVICE_API_KEY is set
 * server-side, useRoutePlanning falls back to a clearly-labeled sample
 * straight-line route instead — this screen always shows that as a
 * banner + dashed line, never blending it in as if it were real
 * turn-by-turn directions.
 *
 * Before ever calling the routing API, useRoutePlanning also runs a
 * straight-line feasibility check per activity, and separately surfaces
 * OpenRouteService's own "no route exists" responses — both shown here
 * as the same distinct InfeasibleRouteNotice, rather than the generic
 * error card, so a genuinely impossible trip reads differently from a
 * technical failure.
 *
 * When OpenRouteService returns more than one route (see
 * useRoutePlanning's routeOptions), a row of tappable option chips
 * (Cleanest / Shortest / Balanced / Best) lets you compare trade-offs and
 * switch which one the map + stats below describe — matching the
 * reference app's route-comparison flow instead of only ever showing a
 * single "the" route.
 *
 * For real routes, the line itself is colored segment-by-segment using
 * the nearest real AQI reading at each point along the path (see
 * services/routeAir.ts) — a spatial picture of where air quality
 * actually changes on THIS route, rather than a single trip-wide average
 * number.
 */
export default function RoutePlanningView({ onBack, onUpgrade, aqiReadings }: RoutePlanningViewProps) {
  const {
    origin,
    originLabel,
    locatingOrigin,
    useCurrentLocationAsOrigin,
    setOriginPlace,
    clearOrigin,
    destination,
    setDestinationPlace,
    clearDestination,
    status,
    plan,
    routeOptions,
    selectedRouteIndex,
    selectRoute,
    errorMessage,
    infeasibleReason,
    planCount,
    freeLimitReached,
    canPlan,
    planRoute,
    reset
  } = useRoutePlanning(aqiReadings)
  const [profile, setProfile] = useState<RouteProfile>('foot-walking')

  const busy = locatingOrigin || status === 'loading'

  function handleSelectOrigin(result: PlaceResult) {
    setOriginPlace({ lat: result.lat, lng: result.lng, label: result.label })
  }

  function handleSelectDestination(result: PlaceResult) {
    setDestinationPlace({ lat: result.lat, lng: result.lng, label: result.label })
  }

  const levelsOnRoute =
    plan?.routeSegments && plan.routeSegments.length > 0
      ? Array.from(new Set(plan.routeSegments.map((segment) => segment.level)))
      : []

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Cleaner route" onBack={onBack} />

      <div className="px-4 pt-4 pb-6">
        <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
          Pick a start and end point to see the air quality along the way, based on the nearest real AQI
          readings.
        </p>

        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Start</p>
        <div className="rounded-lg border border-ink-200 dark:border-night-600 mb-1.5">
          <SearchBar onSelectLocation={handleSelectOrigin} activeLabel={originLabel} onClear={clearOrigin} />
        </div>
        <button
          onClick={useCurrentLocationAsOrigin}
          disabled={locatingOrigin}
          className="text-xs font-medium text-[#1F4D3A] dark:text-[#8FC7A6] flex items-center gap-1 mb-4 disabled:opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 4 21l8-4.5L20 21Z" />
          </svg>
          {locatingOrigin ? 'Getting your location…' : 'Use current location'}
        </button>

        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">End</p>
        <div className="rounded-lg border border-ink-200 dark:border-night-600 mb-4">
          <SearchBar
            onSelectLocation={handleSelectDestination}
            activeLabel={destination?.label ?? null}
            onClear={clearDestination}
          />
        </div>

        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Activity</p>
        <div className="flex gap-2 mb-4">
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

        <button
          onClick={() => planRoute(profile)}
          disabled={!canPlan || busy || freeLimitReached}
          className="w-full py-3 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-semibold disabled:opacity-40 mb-2"
        >
          {busy
            ? locatingOrigin
              ? 'Getting your location…'
              : 'Finding routes…'
            : 'Find routes'}
        </button>

        <RemainingPlansNotice planCount={planCount} onUpgrade={onUpgrade} />

        {status === 'infeasible' && infeasibleReason && <InfeasibleRouteNotice reason={infeasibleReason} />}

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

            {routeOptions.length > 1 && (
              <div>
                <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">
                  {routeOptions.length} route options
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                  {routeOptions.map((option, index) => {
                    const selected = index === selectedRouteIndex
                    return (
                      <button
                        key={index}
                        onClick={() => selectRoute(index)}
                        className={`shrink-0 text-left rounded-xl px-3 py-2 border ${
                          selected
                            ? 'border-[#1F4D3A] dark:border-[#8FC7A6] bg-[#1F4D3A]/10 dark:bg-[#8FC7A6]/10'
                            : 'border-ink-200 dark:border-night-600'
                        }`}
                      >
                        <p className="text-xs font-semibold text-ink-900 dark:text-night-100 m-0">
                          {option.label ?? `Route ${index + 1}`}
                        </p>
                        <p className="text-[11px] text-ink-600 dark:text-night-200 m-0 mt-0.5">
                          {formatDistance(option.route.distanceMeters)}
                          {option.routeAvgAqi != null ? ` · AQI ${option.routeAvgAqi}` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
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
                {plan.usingSampleData ? (
                  <Polyline
                    positions={plan.route.coordinates}
                    pathOptions={{ color: '#1F4D3A', weight: 4, dashArray: '6 6' }}
                  />
                ) : plan.routeSegments && plan.routeSegments.length > 0 ? (
                  plan.routeSegments.map((segment, index) => (
                    <Polyline
                      key={index}
                      positions={segment.coordinates}
                      pathOptions={{ color: aqiColor[segment.level], weight: 5 }}
                    />
                  ))
                ) : (
                  <Polyline positions={plan.route.coordinates} pathOptions={{ color: '#1F4D3A', weight: 4 }} />
                )}
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

            {levelsOnRoute.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 px-0.5">
                {levelsOnRoute.map((level) => (
                  <span
                    key={level}
                    className="flex items-center gap-1 text-[11px] text-ink-600 dark:text-night-200"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: aqiColor[level] }} />
                    {aqiLevelLabel[level]}
                  </span>
                ))}
              </div>
            )}

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

            {plan.worstStretch && (
              <div
                className="rounded-xl px-3.5 py-3 border"
                style={{
                  backgroundColor: `${aqiColor[plan.worstStretch.segment.level]}1A`,
                  borderColor: `${aqiColor[plan.worstStretch.segment.level]}4D`
                }}
              >
                <p className="text-xs text-ink-900 dark:text-night-100 m-0">
                  Air quality dips to{' '}
                  <span className="font-semibold">{aqiLevelLabel[plan.worstStretch.segment.level]}</span> about{' '}
                  {formatDistance(plan.worstStretch.distanceFromStartMeters)} into your route.
                </p>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
            >
              Plan another route
            </button>
          </div>
        )}

        {status === 'idle' && !plan && (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-2 m-0">
            Set a start and end point above, then tap Find routes.
          </p>
        )}
      </div>
    </div>
  )
}
