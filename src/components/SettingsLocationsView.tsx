import { useEffect, useState } from 'react'
import ScreenHeader from './ScreenHeader'
import SearchBar from './SearchBar'
import type { PlaceResult } from '../services/geocode'
import {
  addSavedLocation,
  deleteSavedLocation,
  listSavedLocations,
  ROOM_LABELS,
} from '../services/savedLocations'
import type { LocationRoom, SavedLocation } from '../services/savedLocations'
import { fetchAqiForLocation } from '../services/locationAqi'
import type { LocationAqi } from '../services/locationAqi'
import { aqiColor, aqiLevelLabel } from '../aqiColors'

interface SettingsLocationsViewProps {
  onBack: () => void
}

const ROOM_OPTIONS: LocationRoom[] = ['home', 'office', 'gym', 'school', 'other']

/** Live AQI pill for one saved location — fetched independently per row
 * (not batched) so a slow or failed lookup for one location never blocks
 * or blanks the others. Reuses the same AirNow-backed
 * fetchAqiForLocation() the rest of the app's live data goes through. */
function LocationAqiPill({ lat, lng }: { lat: number; lng: number }) {
  const [result, setResult] = useState<LocationAqi | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    setResult('loading')
    fetchAqiForLocation(lat, lng).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (result === 'loading') {
    return <span className="text-xs text-ink-400 dark:text-night-400">Checking air quality…</span>
  }
  if (!result) {
    return <span className="text-xs text-ink-400 dark:text-night-400">No AQI data nearby</span>
  }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: aqiColor[result.level] }}
    >
      {result.value} · {aqiLevelLabel[result.level]}
    </span>
  )
}

/** Real destination search (Photon, via SearchBar — same one Route
 * Planning uses) plus a room tag, so a saved location is more than just an
 * address — it's tagged the way AirTrack's own saved-locations feature
 * tags home/office/gym/school for later per-room modeling. */
function AddLocationForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: { label: string; room: LocationRoom; lat: number; lng: number }) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<PlaceResult | null>(null)
  const [room, setRoom] = useState<LocationRoom>('home')

  return (
    <div className="rounded-xl border border-ink-200 dark:border-night-600 mb-4 overflow-hidden">
      <SearchBar
        onSelectLocation={setSelected}
        activeLabel={selected?.label ?? null}
        onClear={() => setSelected(null)}
      />
      <div className="px-3 pt-3 pb-3 space-y-3">
        <div>
          <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Room</p>
          <div className="flex flex-wrap gap-2">
            {ROOM_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRoom(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  room === r
                    ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900'
                    : 'bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100'
                }`}
              >
                {ROOM_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onAdd({ label: selected.label, room, lat: selected.lat, lng: selected.lng })}
            className="flex-1 py-2 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium disabled:opacity-40"
          >
            Save location
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Saved locations with room tagging (home/office/gym/school/other),
 * persisted to localStorage (see services/savedLocations.ts) — the same
 * web-realistic, foreground/no-accounts scope as activityLog.ts. Each
 * saved location shows its own live AQI, fetched independently per row.
 */
export default function SettingsLocationsView({ onBack }: SettingsLocationsViewProps) {
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLocations(listSavedLocations())
  }, [])

  function handleAdd(input: { label: string; room: LocationRoom; lat: number; lng: number }) {
    addSavedLocation(input)
    setLocations(listSavedLocations())
    setAdding(false)
  }

  function handleDelete(id: string) {
    deleteSavedLocation(id)
    setLocations(listSavedLocations())
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Locations" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        {adding ? (
          <AddLocationForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full mb-4 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#1F4D3A] dark:bg-[#8FC7A6] dark:text-night-900"
          >
            + Add Location
          </button>
        )}

        {locations.length === 0 ? (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center">
            No locations yet. Save a home, office, gym, or school to check its air quality anytime without
            searching for it again.
          </p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-[11px] font-semibold text-[#1F4D3A] dark:text-[#8FC7A6] uppercase tracking-wide m-0">
                    {ROOM_LABELS[loc.room]}
                  </p>
                  <p className="text-sm text-ink-900 dark:text-night-100 m-0 mt-0.5 truncate">{loc.label}</p>
                  <div className="mt-1">
                    <LocationAqiPill lat={loc.lat} lng={loc.lng} />
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(loc.id)}
                  aria-label={`Remove ${loc.label}`}
                  className="text-xs text-aqi-unhealthy underline shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
