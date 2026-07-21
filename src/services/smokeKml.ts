import { SmokeDensity, SmokePolygon } from '../types'

// NOAA's smoke.kml is small and structurally predictable — one flat list of
// <Placemark> polygons, each tagged with a density styleUrl. Regex extraction
// avoids pulling in a DOM/XML dependency and works identically in the browser
// (client fetch) or a Node backend (serverless proxy), which matters since we
// don't control where this eventually runs.
//
// Note: earlier notes on this project assumed NOAA's smoke product was a raw
// raster needing a classification step. That was wrong — it ships as vector
// polygons already bucketed into light/medium/heavy density, so parsing is
// all that's needed here.

function densityFromStyleUrl(styleUrl: string): SmokeDensity {
  const s = styleUrl.toLowerCase()
  if (s.includes('heavy')) return 'heavy'
  if (s.includes('medium')) return 'medium'
  return 'light' // NOAA's own default bucket
}

function noaaTimeToIso(raw: string): string | null {
  // "07/19/2026 1000 UTC" -> ISO 8601
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})/)
  if (!match) return null
  const [, mm, dd, yyyy, hh, min] = match
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseDescription(desc: string) {
  const startMatch = desc.match(/Start Time:\s*([\d/]+\s+\d+\s*UTC)/i)
  const endMatch = desc.match(/End Time:\s*([\d/]+\s+\d+\s*UTC)/i)
  const densityMatch = desc.match(/Density:\s*(\d+)/i)
  const satelliteMatch = desc.match(/Satellite:\s*([A-Z0-9-]+)/i)

  return {
    startTime: startMatch ? noaaTimeToIso(startMatch[1]) : null,
    endTime: endMatch ? noaaTimeToIso(endMatch[1]) : null,
    densityValue: densityMatch ? parseInt(densityMatch[1], 10) : null,
    satellite: satelliteMatch ? satelliteMatch[1] : null
  }
}

// Parses "-75.5,39.8,0 -75.0,39.8,0 ..." into [[lng,lat], ...], dropping altitude.
function parseCoordinateString(raw: string): [number, number][] {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((triplet) => {
      const [lng, lat] = triplet.split(',').map(Number)
      return [lng, lat] as [number, number]
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
}

function extractTag(block: string, tag: string): string | null {
  // Handles both plain and CDATA-wrapped content.
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : null
}

/**
 * Parses a NOAA HMS smoke.kml document (raw text) into typed SmokePolygon objects.
 * No DOM/XML library required — safe to run in the browser or any JS backend.
 */
export function parseSmokeKml(kmlText: string): SmokePolygon[] {
  const polygons: SmokePolygon[] = []
  const placemarkBlocks = kmlText.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []

  placemarkBlocks.forEach((block, idx) => {
    const styleUrl = extractTag(block, 'styleUrl') || ''
    const description = extractTag(block, 'description') || ''
    const parsed = parseDescription(description)

    // A Placemark can contain multiple outerBoundaryIs rings if it's a MultiGeometry;
    // treat each ring as its own polygon so the map layer can render/color them independently.
    const ringMatches = block.match(/<outerBoundaryIs>[\s\S]*?<\/outerBoundaryIs>/g) || []

    ringMatches.forEach((ringBlock, ringIdx) => {
      const coordText = extractTag(ringBlock, 'coordinates')
      if (!coordText) return
      const coordinates = parseCoordinateString(coordText)
      if (coordinates.length < 3) return // not a valid ring

      polygons.push({
        id: `smoke-${idx}-${ringIdx}`,
        density: densityFromStyleUrl(styleUrl),
        densityValue: parsed.densityValue,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        satellite: parsed.satellite,
        coordinates
      })
    })
  })

  return polygons
}
