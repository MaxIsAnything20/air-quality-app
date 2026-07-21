import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { AqiReading, FieldReport, PurpleAirReading, RegionSelection, SmokeDensity, SmokePolygon } from '../types'
import { aqiColor } from '../aqiColors'
import { MapSnapshot } from '../services/mapSnapshotLog'
import { formatStepLabel } from '../utils/timeSteps'
import MapLegend from './MapLegend'

type Layer = 'smoke' | 'fires' | 'aqi' | 'purpleair'

interface Props {
  aqiReadings: AqiReading[]
  fieldReports: FieldReport[]
  smokePolygons: SmokePolygon[]
  purpleAirReadings: PurpleAirReading[]
  center: [number, number]
  // Time slider support — real logged past days + AirNow's real regional
  // forecast for "Tomorrow". See services/mapSnapshotLog.ts and
  // useAirQuality's tomorrowAqiReadings for why these are real, not
  // fabricated: NOAA's smoke/fire archive has no reliable per-date URL, so
  // "past" only goes back to whatever this browser has actually logged,
  // and "tomorrow" only ever covers AQI (AirNow's forecast) since smoke
  // and fire simply have no forecast product to draw from.
  pastMapDates: string[]
  getMapSnapshotForDate: (date: string) => MapSnapshot | null
  tomorrowAqiReadings: AqiReading[]
  // Tapping an AQI circle selects that specific monitoring station so the
  // summary card below can describe it instead of the overall location.
  // Carries which time-slider step it came from — without that, a summary
  // for a past day or tomorrow's forecast has no way to avoid describing
  // itself as "current."
  selectedRegion: RegionSelection | null
  onSelectRegion: (selection: RegionSelection | null) => void
}

// Muted, semi-transparent by design so smoke polygons don't visually compete
// with the AQI severity circles when both are relevant to the same area.
const SMOKE_STYLE: Record<SmokeDensity, { color: string; fillOpacity: number }> = {
  light: { color: '#8B8A82', fillOpacity: 0.15 },
  medium: { color: '#57564F', fillOpacity: 0.28 },
  heavy: { color: '#1A1A18', fillOpacity: 0.4 }
}

// react-leaflet's `center`/`zoom` props on MapContainer only set the
// *initial* view — changing them on a re-render (e.g. after picking a
// search result) does nothing on its own. This sits inside MapContainer,
// grabs the live map instance via useMap(), and explicitly re-centers it
// whenever `center` changes.
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

function isSameRegion(a: AqiReading | null, b: AqiReading | null): boolean {
  if (!a || !b) return false
  return a.stationName === b.stationName && a.lat === b.lat && a.lng === b.lng
}

export default function MapView({
  aqiReadings,
  fieldReports,
  smokePolygons,
  purpleAirReadings,
  center,
  pastMapDates,
  getMapSnapshotForDate,
  tomorrowAqiReadings,
  selectedRegion,
  onSelectRegion
}: Props) {
  const [activeLayer, setActiveLayer] = useState<Layer>('smoke')
  const mapRef = useRef<LeafletMap | null>(null)

  // Steps: [...logged past days, "today", "tomorrow"] — "tomorrow" only
  // appears if we actually got a real forecast back.
  const steps = useMemo(() => {
    const s = [...pastMapDates, 'today']
    if (tomorrowAqiReadings.length > 0) s.push('tomorrow')
    return s
  }, [pastMapDates, tomorrowAqiReadings.length])

  const todayIndex = steps.indexOf('today')
  const [stepIndex, setStepIndex] = useState(todayIndex)

  // If new past days get logged (or the forecast arrives) after mount,
  // keep the slider pointed at "today" rather than silently jumping the
  // selection to a different index as the steps array grows underneath it.
  useEffect(() => {
    setStepIndex(steps.indexOf('today'))
  }, [pastMapDates.length, tomorrowAqiReadings.length > 0])

  const selectedStep = steps[stepIndex] ?? 'today'
  const isToday = selectedStep === 'today'
  const isTomorrow = selectedStep === 'tomorrow'

  const snapshot = !isToday && !isTomorrow ? getMapSnapshotForDate(selectedStep) : null

  const effectiveAqi = isToday ? aqiReadings : isTomorrow ? tomorrowAqiReadings : snapshot?.aqiReadings ?? []
  const effectiveSmoke = isToday ? smokePolygons : isTomorrow ? [] : snapshot?.smokePolygons ?? []
  const effectiveFire = isToday ? fieldReports : isTomorrow ? [] : snapshot?.fireReports ?? []

  // What to show instead of the layer when this time step just doesn't
  // have data for it — rather than silently rendering nothing and letting
  // it look broken.
  let unavailableMessage: string | null = null
  if (!isToday && activeLayer === 'purpleair') {
    unavailableMessage = "PurpleAir isn't included in past days or forecasts yet — only today's view has it."
  } else if (isTomorrow && (activeLayer === 'smoke' || activeLayer === 'fires')) {
    unavailableMessage = "AirNow's forecast only covers AQI — smoke and fire have no forecast product to show."
  } else if (!isToday && !isTomorrow && !snapshot) {
    unavailableMessage = 'No snapshot was logged for this day.'
  }

  return (
    <div className="relative h-[320px] border-b border-ink-200 dark:border-night-600">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={11}
        className="h-full w-full"
        zoomControl={false}
      >
        <Recenter center={center} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {activeLayer === 'aqi' &&
          effectiveAqi.map((reading, i) => {
            const selected = isSameRegion(reading, selectedRegion?.reading ?? null)
            return (
              <Circle
                key={i}
                center={[reading.lat, reading.lng]}
                radius={reading.radiusMeters}
                pathOptions={{
                  color: selected ? (document.documentElement.classList.contains('dark') ? '#F5F4F0' : '#1A1A18') : aqiColor[reading.level],
                  fillColor: aqiColor[reading.level],
                  fillOpacity: selected ? 0.45 : 0.3,
                  weight: selected ? 3 : 1
                }}
                eventHandlers={{
                  click: () => onSelectRegion(selected ? null : { reading, step: selectedStep })
                }}
              />
            )
          })}

        {activeLayer === 'smoke' &&
          effectiveSmoke.map((poly) => {
            const style = SMOKE_STYLE[poly.density]
            const positions = poly.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
            return (
              <Polygon
                key={poly.id}
                positions={positions}
                pathOptions={{
                  color: style.color,
                  weight: 1,
                  fillColor: style.color,
                  fillOpacity: style.fillOpacity
                }}
              >
                <Tooltip sticky>
                  <span className="text-xs capitalize">{poly.density} smoke</span>
                </Tooltip>
              </Polygon>
            )
          })}

        {activeLayer === 'fires' &&
          effectiveFire
            .filter((r) => r.kind === 'fire')
            .map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={7}
                pathOptions={{ color: '#C24545', fillColor: '#C24545', fillOpacity: 0.9 }}
              />
            ))}

        {activeLayer === 'purpleair' &&
          isToday &&
          purpleAirReadings.map((sensor) => (
            <CircleMarker
              key={sensor.id}
              center={[sensor.lat, sensor.lng]}
              radius={5}
              pathOptions={{
                color: aqiColor[sensor.level],
                fillColor: aqiColor[sensor.level],
                fillOpacity: 0.85,
                weight: 1
              }}
            >
              <Tooltip>
                <span className="text-xs">
                  {sensor.name} — PM2.5 {sensor.pm25} µg/m³ (AQI {sensor.aqi})
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      {unavailableMessage && (
        <div className="absolute top-11 left-3 right-3 z-[1000] bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 rounded-lg px-3 py-2 shadow-sm">
          <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">{unavailableMessage}</p>
        </div>
      )}

      <MapLegend activeLayer={activeLayer} />

      <div className="absolute top-3 left-3 z-[1000] flex gap-1.5">
        {(['smoke', 'fires', 'aqi', 'purpleair'] as Layer[]).map((layer) => (
          <button
            key={layer}
            onClick={() => setActiveLayer(layer)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              activeLayer === layer
                ? 'bg-white dark:bg-night-800 border-ink-400 dark:border-night-500 text-ink-900 dark:text-night-100'
                : 'bg-white dark:bg-night-800 border-transparent text-ink-400 dark:text-night-400'
            }`}
          >
            {layer === 'aqi' ? 'AQI' : layer === 'purpleair' ? 'PurpleAir' : layer[0].toUpperCase() + layer.slice(1)}
          </button>
        ))}
      </div>

      <div className="absolute bottom-11 right-3 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="w-8 h-8 rounded-lg bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="w-8 h-8 rounded-lg bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
        >
          −
        </button>
        <button
          onClick={() => mapRef.current?.setView(center, 13, { animate: true })}
          aria-label="Center on selected location"
          className="w-8 h-8 rounded-lg bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {steps.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white dark:bg-night-800 border-t border-ink-200 dark:border-night-600 px-3 py-1.5 flex items-center gap-2">
          <span className="text-[11px] text-ink-600 dark:text-night-200 w-[92px] shrink-0">
            {formatStepLabel(selectedStep)}
          </span>
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            step={1}
            value={stepIndex}
            onChange={(e) => setStepIndex(Number(e.target.value))}
            className="flex-1 accent-ink-900 dark:accent-night-100"
            aria-label="Time"
          />
          {!isToday && (
            <button
              onClick={() => setStepIndex(todayIndex)}
              className="text-[11px] text-ink-400 dark:text-night-400 underline shrink-0"
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  )
}
