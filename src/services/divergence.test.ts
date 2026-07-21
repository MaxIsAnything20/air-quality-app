import { describe, it, expect } from 'vitest'
import { detectDivergence, summarizeDivergence } from './divergence'
import { AqiReading, PurpleAirReading } from '../types'

function station(overrides: Partial<AqiReading> = {}): AqiReading {
  return {
    value: 40,
    level: 'good',
    lat: 37.77,
    lng: -122.42,
    radiusMeters: 5000,
    stationName: 'San Francisco, CA',
    pollutant: 'PM2.5',
    observedAt: 'Jul 21, 2:00 PM PDT',
    ...overrides
  }
}

function sensor(overrides: Partial<PurpleAirReading> = {}): PurpleAirReading {
  return {
    id: 1,
    name: 'Backyard Sensor',
    lat: 37.77,
    lng: -122.42,
    pm25: 20,
    aqi: 68,
    level: 'moderate',
    updatedMinutesAgo: 5,
    ...overrides
  }
}

describe('detectDivergence', () => {
  it('returns no alerts when either input list is empty', () => {
    expect(detectDivergence([], [sensor()])).toEqual([])
    expect(detectDivergence([station()], [])).toEqual([])
  })

  it('does not flag a sensor that roughly agrees with the nearest station', () => {
    const alerts = detectDivergence([station({ value: 45, level: 'moderate' })], [sensor({ aqi: 55, level: 'moderate' })])
    expect(alerts).toEqual([])
  })

  it('flags a sensor that is >=2 AQI levels worse than the nearest station', () => {
    const alerts = detectDivergence(
      [station({ value: 40, level: 'good' })],
      [sensor({ aqi: 160, level: 'unhealthy' })]
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].levelGap).toBeGreaterThanOrEqual(2)
  })

  it('flags a sensor with a >=50 point AQI gap even within the same category', () => {
    const alerts = detectDivergence(
      [station({ value: 55, level: 'moderate' })],
      [sensor({ aqi: 105, level: 'sensitive' })]
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].aqiGap).toBeGreaterThanOrEqual(50)
  })

  it('ignores a sensor/station pair further apart than the max pairing distance', () => {
    // ~1 degree of latitude is roughly 111km, well past the 60km cutoff
    const alerts = detectDivergence(
      [station({ lat: 38.77, lng: -122.42, value: 40, level: 'good' })],
      [sensor({ lat: 37.77, lng: -122.42, aqi: 200, level: 'veryunhealthy' })]
    )
    expect(alerts).toEqual([])
  })

  it('does not flag when official reads worse than the citizen sensor (one-directional by design)', () => {
    const alerts = detectDivergence(
      [station({ value: 180, level: 'unhealthy' })],
      [sensor({ aqi: 40, level: 'good' })]
    )
    expect(alerts).toEqual([])
  })

  it('sorts multiple alerts worst-gap-first', () => {
    const stations = [station({ lat: 37.77, lng: -122.42, value: 40, level: 'good' })]
    const sensors = [
      sensor({ id: 1, lat: 37.77, lng: -122.42, aqi: 150, level: 'unhealthy' }),
      sensor({ id: 2, lat: 37.77, lng: -122.42, aqi: 300, level: 'hazardous' })
    ]
    const alerts = detectDivergence(stations, sensors)
    expect(alerts).toHaveLength(2)
    expect(alerts[0].sensor.id).toBe(2)
    expect(alerts[1].sensor.id).toBe(1)
  })
})

describe('summarizeDivergence', () => {
  it('returns null when there are no alerts', () => {
    expect(summarizeDivergence([])).toBeNull()
  })

  it('describes a single sensor by name', () => {
    const alerts = detectDivergence(
      [station({ value: 40, level: 'good', stationName: 'Oakland, CA' })],
      [sensor({ aqi: 200, level: 'veryunhealthy', name: 'Rockridge Sensor' })]
    )
    const note = summarizeDivergence(alerts)
    expect(note).toContain('Rockridge Sensor')
    expect(note).toContain('Oakland, CA')
  })

  it('describes multiple sensors with a count instead of names', () => {
    const stations = [station({ value: 40, level: 'good' })]
    const sensors = [
      sensor({ id: 1, aqi: 150, level: 'unhealthy' }),
      sensor({ id: 2, aqi: 300, level: 'hazardous' })
    ]
    const note = summarizeDivergence(detectDivergence(stations, sensors))
    expect(note).toContain('2 nearby citizen sensors')
  })
})
