import { DivergenceAlert } from '../services/divergence'

/** Distinct from ConditionBanner on purpose: this isn't about the AQI
 *  level itself, it's about the *official and citizen sensor data
 *  disagreeing* — a different kind of signal (possible fast-developing
 *  event) that deserves its own visual identity (amber/warning, not tied
 *  to aqiColor) rather than being folded into the AQI banner above it. */
export default function DivergenceBanner({ alerts }: { alerts: DivergenceAlert[] }) {
  if (alerts.length === 0) return null
  const worst = alerts[0]
  const count = alerts.length

  return (
    <div className="flex gap-2.5 items-start px-4 py-3 border-b border-ink-200 dark:border-night-600 bg-[#D2762E1F]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D2762E" strokeWidth="2" className="mt-0.5 shrink-0">
        <path d="M12 2 2 20h20L12 2Z" />
        <path d="M12 9v5M12 17h.01" />
      </svg>
      <div>
        <p className="text-sm font-medium m-0" style={{ color: '#D2762E' }}>
          Nearby sensors disagree
        </p>
        <p className="text-xs text-ink-600 dark:text-night-200 m-0 mt-0.5">
          {count > 1
            ? `${count} PurpleAir sensors report notably worse air than the nearest official reading. `
            : `${worst.sensor.name} reports notably worse air than the nearest official reading. `}
          Worst: sensor AQI {worst.sensor.aqi} vs. official AQI {worst.nearestStation.value} near{' '}
          {worst.nearestStation.stationName} (~{Math.round(worst.distanceKm)}km away). Could mean a
          fast-developing local event official monitors haven't caught up to yet — they usually do
          within an hour or two.
        </p>
      </div>
    </div>
  )
}
