export type LocationRoom = 'home' | 'office' | 'gym' | 'school' | 'other'

export interface SavedLocation {
  id: string
  label: string
  room: LocationRoom
  lat: number
  lng: number
}

/**
 * Saved locations with room tagging (home/office/gym/school/other) —
 * foreground/localStorage-only, same reasoning as activityLog.ts: no
 * accounts or backend to sync this to yet, so it lives on the device the
 * location was saved on. Each location just stores a label + coordinates;
 * live AQI for it is fetched on demand (see services/locationAqi.ts)
 * rather than cached here, so it's never shown stale.
 */
const LOCATIONS_KEY = 'respira.savedLocations.v1'

function readAll(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(locations: SavedLocation[]) {
  try {
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations))
  } catch {
    // Storage full or unavailable (private browsing, etc.) — fail silently,
    // matches the rest of the app's localStorage-backed services.
  }
}

export function listSavedLocations(): SavedLocation[] {
  return readAll()
}

export function addSavedLocation(input: { label: string; room: LocationRoom; lat: number; lng: number }): SavedLocation {
  const locations = readAll()
  const location: SavedLocation = {
    id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input
  }
  locations.push(location)
  writeAll(locations)
  return location
}

export function deleteSavedLocation(id: string): void {
  writeAll(readAll().filter((l) => l.id !== id))
}

export const ROOM_LABELS: Record<LocationRoom, string> = {
  home: 'Home',
  office: 'Office',
  gym: 'Gym',
  school: 'School',
  other: 'Other'
}
