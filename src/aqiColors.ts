import { AqiLevel } from './types'

export const aqiColor: Record<AqiLevel, string> = {
  good: '#3B9E5F',
  moderate: '#C99A2E',
  sensitive: '#D2762E',
  unhealthy: '#C24545',
  veryunhealthy: '#8A4FA0',
  hazardous: '#6E2E36'
}

export const aqiBg: Record<AqiLevel, string> = {
  good: 'bg-aqi-good/10',
  moderate: 'bg-aqi-moderate/10',
  sensitive: 'bg-aqi-sensitive/10',
  unhealthy: 'bg-aqi-unhealthy/10',
  veryunhealthy: 'bg-aqi-veryunhealthy/10',
  hazardous: 'bg-aqi-hazardous/10'
}

export const aqiLevelLabel: Record<AqiLevel, string> = {
  good: 'Good',
  moderate: 'Moderate',
  sensitive: 'Unhealthy for sensitive groups',
  unhealthy: 'Unhealthy',
  veryunhealthy: 'Very unhealthy',
  hazardous: 'Hazardous'
}
