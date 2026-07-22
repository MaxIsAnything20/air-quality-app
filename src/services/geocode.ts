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

// This app's only real air quality data source (AirNow) is a US EPA feed —
// there's no real reading to show anywhere outside the United States, so
// restricting search results to the US isn't an arbitrary limitation, it
// matches what the rest of the app can actually do with a location. Also
// meaningfully narrows Nominatim's candidate pool, which helps a precise
// address rank higher instead of getting crowded out by same-named places
// abroad.
const COUNTRY_CODES = 'us'

// Real US street addresses often carry an apartment/unit/suite suffix
// (e.g. "123 Main St Apt 4B") that OpenStreetMap — Nominatim's underlying
// data source — very rarely indexes at that granularity; it typically only
// has the building itself. So an exact query for a specific apartment can
// come back empty even though the building is very much on the map. Rather
// than give up, searchPlaces retries once with the unit suffix stripped so
// the real building still surfaces — never inventing a location, just not
// letting a unit number the data source doesn't track hide a real address.
const UNIT_SUFFIX_PATTERN = /[,\s]+(?:apt|apartment|unit|ste|suite|#)\.?\s*[\w-]+\s*$/i

function stripUnitSuffix(query: string): string | null {
  const stripped = query.replace(UNIT_SUFFIX_PATTERN, '').trim()
  return stripped && stripped !== query ? stripped : null
}

async function runSearch(query: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '8',
    addressdetails: '1',
    countrycodes: COUNTRY_CODES
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

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const results = await runSearch(trimmed)
  if (results.length > 0) return results

  const withoutUnit = stripUnitSuffix(trimmed)
  if (withoutUnit) {
    return runSearch(withoutUnit)
  }

  return []
}
