import { useEffect, useState } from 'react'
import { fetchFullPollutantBreakdown, FullPollutantBreakdown } from '../services/openMeteoAirQuality'

/** Fetches the Open-Meteo full pollutant breakdown for a coordinate,
 * refetching whenever lat/lng changes. Pass null for either to skip
 * fetching (e.g. while showing sample data) — matches the pattern
 * other data hooks in this app use for "nothing to fetch yet." */
export function useFullPollutantBreakdown(lat: number | null, lng: number | null) {
  const [data, setData] = useState<FullPollutantBreakdown | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat == null || lng == null) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchFullPollutantBreakdown(lat, lng).then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [lat, lng])

  return { data, loading }
}
