import { describe, it, expect } from 'vitest'
import { outdoorRecommendation, AQI_GUIDANCE } from './aqiGuidance'
import { AqiLevel } from '../types'

const LEVELS: AqiLevel[] = ['good', 'moderate', 'sensitive', 'unhealthy', 'veryunhealthy', 'hazardous']

describe('outdoorRecommendation', () => {
  it('returns general advice with no time estimate for "good"', () => {
    const { advice, timeEstimate } = outdoorRecommendation('good', false)
    expect(advice).toBe(AQI_GUIDANCE.good.generalAdvice)
    expect(timeEstimate).toBeNull()
  })

  it('falls back to general advice for sensitive users when a level has no sensitiveAdvice text', () => {
    const { advice } = outdoorRecommendation('good', true)
    expect(advice).toBe(AQI_GUIDANCE.good.generalAdvice)
  })

  it('uses sensitive-specific advice and time estimate when flagged sensitive', () => {
    const { advice, timeEstimate } = outdoorRecommendation('moderate', true)
    expect(advice).toBe(AQI_GUIDANCE.moderate.sensitiveAdvice)
    expect(timeEstimate).toBe('roughly 120 minutes or less')
  })

  it('omits a time estimate once the max minutes is 0 ("avoid entirely" is already in the advice)', () => {
    const { timeEstimate } = outdoorRecommendation('unhealthy', true)
    expect(timeEstimate).toBeNull()
  })

  it('every level produces non-empty advice for both general and sensitive readers', () => {
    for (const level of LEVELS) {
      expect(outdoorRecommendation(level, false).advice.length).toBeGreaterThan(0)
      expect(outdoorRecommendation(level, true).advice.length).toBeGreaterThan(0)
    }
  })

  it('never labels the illustrative time estimate as an EPA figure', () => {
    for (const level of LEVELS) {
      const { timeEstimate } = outdoorRecommendation(level, true)
      if (timeEstimate) expect(timeEstimate).not.toMatch(/EPA/i)
    }
  })
})
