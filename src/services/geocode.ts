export interface PlaceResult {
  label: string
  lat: number
  lng: number
}

// OpenStreetMap's Nominatim search API — same data source as the map tiles
// already in use, and (unlike AirNow) needs no API key. Handles both place
// names and postal codes/ZIP codes through one endpoint.
//
// Note: Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// asks for a low request rate and an identifying User-Agent/Referer. Browsers
// don't let scripts set a custom User-Agent, but they do send Referer
// automatically, which covers most of that ask for light/personal use. For a
// public production deploy with real traffic, proxy this through your own
// backend (same reasoning as the AirNow key — see README) so you can set
// proper headers and cache repeat queries instead of hitting Nominatim
// directly on every keystroke.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    limit: '5',
    addressdetails: '1'
  })

  const res = await fetch(`${NOMINATIM_URL}?${params}`)
  if (!res.ok) {
    throw new Error(`Place search failed: ${res.status}`)
  }

  const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json()
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon)
  }))
}
