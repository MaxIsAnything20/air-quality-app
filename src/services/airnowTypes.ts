export interface AirNowCategory {
  Number: number
  Name: string
}

export interface AirNowObservation {
  DateObserved: string
  HourObserved: number
  LocalTimeZone: string
  ReportingArea: string
  StateCode: string
  Latitude: number
  Longitude: number
  ParameterName: string
  AQI: number
  Category: AirNowCategory
}

export interface AirNowForecast {
  DateIssue: string
  DateForecast: string
  ReportingArea: string
  StateCode: string
  Latitude: number
  Longitude: number
  ParameterName: string
  AQI: number
  Category: AirNowCategory
}
