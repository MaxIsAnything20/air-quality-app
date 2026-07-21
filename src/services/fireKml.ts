import { FieldReport } from '../types'

// Same reasoning as smokeKml.ts: NOAA's fire.kml is small/predictable enough
// that regex extraction beats pulling in a DOM/XML dependency, and it works
// identically in the browser or a Node backend.
//
// Structurally this is the *point* sibling of smoke.kml: same feed family
// (ospo.noaa.gov/data/land/fire/), same <Placemark> shape, but geometry is
// <Point><coordinates> instead of <outerBoundaryIs>, and the description
// block carries detection metadata (YearDay, Time, Satellite, Method of
// Detection) instead of smoke density/start/end.

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : null
}

// "-68.5009160000000037,18.7265049999999995,0" -> { lng, lat }
function parsePointCoordinates(raw: string): { lat: number; lng: number } | null {
  const [lng, lat] = raw.trim().split(',').map(Number)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { lat, lng }
}

// "YearDay: 2022199" -> day 199 of year 2022 (UTC), combined with "Time: 0533" (UTC HHMM)
function yearDayTimeToDate(yearDay: string, time: string): Date | null {
  const ydMatch = yearDay.match(/(\d{4})(\d{3})/)
  const timeMatch = time.match(/(\d{2})(\d{2})/)
  if (!ydMatch || !timeMatch) return null

  const [, yyyy, ddd] = ydMatch
  const [, hh, min] = timeMatch
  // Day 1 of the year is Jan 1st, so day-of-year N is (N-1) days after Jan 1.
  const date = new Date(Date.UTC(Number(yyyy), 0, 1))
  date.setUTCDate(date.getUTCDate() + (Number(ddd) - 1))
  date.setUTCHours(Number(hh), Number(min), 0, 0)
  return isNaN(date.getTime()) ? null : date
}

function parseFireDescription(desc: string) {
  const yearDayMatch = desc.match(/YearDay:\s*(\d+)/i)
  const timeMatch = desc.match(/Time:\s*(\d+)/i)
  const satelliteMatch = desc.match(/Satellite:\s*([^\n\r]+)/i)
  const methodMatch = desc.match(/Method of Detection:\s*([^\n\r]+)/i)

  const detectedAt =
    yearDayMatch && timeMatch ? yearDayTimeToDate(yearDayMatch[1], timeMatch[1]) : null

  return {
    detectedAt,
    satellite: satelliteMatch ? satelliteMatch[1].trim() : null,
    method: methodMatch ? methodMatch[1].trim() : null
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

interface ParseFireKmlOptions {
  /** Only keep detections within this many km of `near`. Fire.kml covers all
   *  of North America (often thousands of points/day), which would both
   *  overwhelm the map and the "nearby reports" list if left unfiltered. */
  near?: { lat: number; lng: number }
  radiusKm?: number
}

/**
 * Parses a NOAA HMS fire.kml document (raw text) into typed FieldReport objects.
 * No DOM/XML library required — safe to run in the browser or any JS backend.
 */
export function parseFireKml(kmlText: string, options: ParseFireKmlOptions = {}): FieldReport[] {
  const { near, radiusKm = 300 } = options
  const now = new Date()
  const reports: FieldReport[] = []

  const placemarkBlocks = kmlText.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []

  placemarkBlocks.forEach((block, idx) => {
    const description = extractTag(block, 'description') || ''
    const coordText = extractTag(block, 'coordinates')
    if (!coordText) return

    const point = parsePointCoordinates(coordText)
    if (!point) return

    if (near && haversineKm(near, point) > radiusKm) return

    const { detectedAt, satellite } = parseFireDescription(description)
    const updatedMinutesAgo = detectedAt
      ? Math.max(0, Math.round((now.getTime() - detectedAt.getTime()) / 60000))
      : 0

    reports.push({
      id: `fire-${idx}`,
      kind: 'fire',
      title: satellite ? `Fire detected (${satellite})` : 'Fire detected',
      updatedMinutesAgo,
      lat: point.lat,
      lng: point.lng
    })
  })

  return reports
}
