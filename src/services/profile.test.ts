import { describe, it, expect, beforeEach } from 'vitest'
import { loadHealthProfile, saveHealthProfile, isSensitiveGroup } from './profile'

beforeEach(() => {
  localStorage.clear()
})

describe('isSensitiveGroup', () => {
  it('is false for an empty conditions list', () => {
    expect(isSensitiveGroup({ conditions: [] })).toBe(false)
  })

  it('is true when any condition is present', () => {
    expect(isSensitiveGroup({ conditions: ['asthma'] })).toBe(true)
  })
})

describe('loadHealthProfile / saveHealthProfile', () => {
  it('defaults to an empty profile when nothing is stored', () => {
    expect(loadHealthProfile()).toEqual({ conditions: [] })
  })

  it('round-trips a saved profile', () => {
    saveHealthProfile({ conditions: ['asthma', 'child'] })
    expect(loadHealthProfile()).toEqual({ conditions: ['asthma', 'child'] })
  })

  it('falls back to the default profile on corrupt stored JSON', () => {
    localStorage.setItem('airtrack:healthProfile', '{not valid json')
    expect(loadHealthProfile()).toEqual({ conditions: [] })
  })

  it('falls back to the default profile when conditions is not an array', () => {
    localStorage.setItem('airtrack:healthProfile', JSON.stringify({ conditions: 'asthma' }))
    expect(loadHealthProfile()).toEqual({ conditions: [] })
  })
})
