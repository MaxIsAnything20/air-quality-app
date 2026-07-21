import { AirNowForecast, AirNowObservation } from './airnowTypes'
import { ConditionAlert } from '../types'
import { aqiLevelFromValue } from '../types'

export function buildConditionAlert(
  current: AirNowObservation,
  forecast?: AirNowForecast
): ConditionAlert {
  const level = aqiLevelFromValue(current.AQI)
  const categoryName = current.Category.Name

  if (forecast && forecast.AQI > current.AQI + 20) {
    const forecastLevel = aqiLevelFromValue(forecast.AQI)
    return {
      level: forecastLevel,
      headline: `Air quality expected to worsen`,
      detail: `Currently ${categoryName.toLowerCase()} (AQI ${current.AQI}), forecast to reach ${forecast.Category.Name.toLowerCase()} (AQI ${forecast.AQI}).`
    }
  }

  return {
    level,
    headline: `${categoryName} air quality`,
    detail: `Current AQI is ${current.AQI} in ${current.ReportingArea}, ${current.StateCode}.`
  }
}
