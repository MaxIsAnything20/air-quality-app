import { describe, it, expect, beforeEach } from 'vitest'
import { loadAlertSettings, saveAlertSettings, suggestedThresholdAqi } from './alertSettings'

beforeEach(() => {
  localStorage.clear()
})

describe('suggestedThresholdAqi', () => {
  it('suggests the earlier EPA sensitive-group threshold (51) when sensitive', () => {
    expect(suggestedThresholdAqi(true)).toBe(51)
  })

  it('suggests the general-public threshold (101) when not sensitive', () => {
    expect(suggestedThresholdAqi(false)).toBe(101)
  })
})

describe('loadAlertSettings / saveAlertSettings', () => {
  it('returns sensible defaults when nothing is stored yet', () => {
    expect(loadAlertSettings(false)).toEqual({ enabled: false, thresholdAqi: 101 })
    expect(loadAlertSettings(true)).toEqual({ enabled: false, thresholdAqi: 51 })
  })

  it('round-trips a saved value', () => {
    saveAlertSettings({ enabled: true, thresholdAqi: 151 })
    expect(loadAlertSettings()).toEqual({ enabled: true, thresholdAqi: 151 })
  })

  it('falls back to defaults instead of throwing on corrupt stored JSON', () => {
    localStorage.setItem('airtrack:alertSettings', '{not valid json')
    expect(loadAlertSettings(true)).toEqual({ enabled: false, thresholdAqi: 51 })
  })

  it('falls back to defaults when the stored shape is missing thresholdAqi', () => {
    localStorage.setItem('airtrack:alertSettings', JSON.stringify({ enabled: true }))
    expect(loadAlertSettings(false)).toEqual({ enabled: false, thresholdAqi: 101 })
  })
})
