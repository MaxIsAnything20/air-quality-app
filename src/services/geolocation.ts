export interface Coords {
  lat: number
  lng: number
}

// Falls back to San Francisco if location is denied, unavailable, or times out.
const FALLBACK_COORDS: Coords = { lat: 37.7749, lng: -122.4194 }

export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(FALLBACK_COORDS)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(FALLBACK_COORDS),
      { timeout: 8000 }
    )
  })
}
