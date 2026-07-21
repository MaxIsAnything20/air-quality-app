import { describe, it, expect } from 'vitest'
import { formatStepLabel, kindOfStep, tenseFor } from './timeSteps'

describe('kindOfStep', () => {
  it('classifies today and tomorrow', () => {
    expect(kindOfStep('today')).toBe('today')
    expect(kindOfStep('tomorrow')).toBe('tomorrow')
  })

  it('classifies anything else as past', () => {
    expect(kindOfStep('2026-07-18')).toBe('past')
  })
})

describe('tenseFor', () => {
  it('uses present tense for today', () => {
    expect(tenseFor('today')).toBe('is currently')
  })

  it('uses future/forecast tense for tomorrow', () => {
    expect(tenseFor('tomorrow')).toBe('is forecast to be')
  })

  it('uses past tense for a past ISO date', () => {
    expect(tenseFor('2026-07-18')).toBe('was')
  })
})

describe('formatStepLabel', () => {
  it('labels today and tomorrow specially', () => {
    expect(formatStepLabel('today')).toBe('Today')
    expect(formatStepLabel('tomorrow')).toBe('Tomorrow (forecast)')
  })

  it('formats a past ISO date as "Mon D"', () => {
    expect(formatStepLabel('2026-07-18')).toBe('Jul 18')
    expect(formatStepLabel('2026-01-05')).toBe('Jan 5')
  })
})
