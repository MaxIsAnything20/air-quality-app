export interface PlaceResult {
  label: string
  lat: number
  lng: number
}

// Photon (https://photon.komoot.io) — a free, no-API-key, no-billing
// geocoder built on the same OpenStreetMap data as the map tiles already in
// use. Unlike Nominatim (this app's previous geocoder), Photon is purpose
// -built for search-as-you-type autocomplete, which is why exact street
// addresses now surface reliably instead of only the roughest place-name
// matches — closer to how Google Maps' search bar behaves, without needing
// a Google Cloud billing account.
//
// Run as a public instance by Komoot. Same "be a good citizen" rate-limit
// consideration as Nominatim previously — for a production app with heavy
// real traffic, proxy this through your own backend instead of calling it
// directly from the browser on every keystroke.
const PHOTON_URL = 'https://photon.komoot.io/api/'

// This app's only real air quality data source (AirNow) is a US EPA feed —
// there's no real reading anywhere outside the United States, so
// restricting results to the US matches what the rest of the app can
// actually do with a location. Photon doesn't take a country-code filter
// param the way Nominatim did, so this over-fetches and filters the
// response client-side by each result's own country code instead.
const US_COUNTRY_CODE = 'us'
const RESULT_LIMIT = 8
const RESULT_OVERFETCH = 20

// Real US street addresses often carry an apartment/unit/suite suffix
// (e.g. "123 Main St Apt 4B") that OpenStreetMap very rarely indexes at
// that granularity — it typically only has the building itself. So an
// exact query for a specific apartment can come back empty even though
// the building is on the map. Rather than give up, searchPlaces retries
// once with the unit suffix stripped so the real building still surfaces
// — never inventing a location, just not letting a unit number hide a
// real, mappable address.
//
// The unit token doesn't always sit at the very end of the string — typed
// addresses are usually "STREET UNIT, CITY, STATE", so city/state trails
// after it. This matches the unit token wherever it appears (not anchored
// to end-of-string) and removes just that piece, leaving the surrounding
// street/city/state intact.
const UNIT_SUFFIX_PATTERN = /[,\s]+(?:apt|apartment|unit|ste|suite|#)\.?\s*[\w-]+/gi

function stripUnitSuffix(query: string): string | null {
  const stripped = query.replace(UNIT_SUFFIX_PATTERN, '').replace(/\s+/g, ' ').trim()
  return stripped && stripped !== query ? stripped : null
}

interface PhotonProperties {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  district?: string
  county?: string
  state?: string
  postcode?: string
  countrycode?: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: PhotonProperties
}

function buildLabel(props: PhotonProperties): string {
  const streetLine = [props.housenumber, props.street].filter(Boolean).join(' ')
  const parts = [
    streetLine || props.name,
    props.city || props.district || props.county,
    props.state,
    props.postcode
  ].filter((part): part is string => Boolean(part))
  return parts.join(', ')
}

async function runSearch(query: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(RESULT_OVERFETCH),
    lang: 'en'
  })

  const res = await fetch(`${PHOTON_URL}?${params}`)
  if (!res.ok) {
    throw new Error(`Place search failed: ${res.status}`)
  }

  const data: { features: PhotonFeature[] } = await res.json()
  return data.features
    .filter((f) => (f.properties.countrycode ?? '').toLowerCase() === US_COUNTRY_CODE)
    .map((f) => ({
      label: buildLabel(f.properties),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }))
    .filter((r) => r.label.length > 0)
    .slice(0, RESULT_LIMIT)
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
