import { useState } from 'react'
import { AqiLevel, SmokeDensity } from '../types'
import { aqiColor } from '../aqiColors'

type Layer = 'smoke' | 'fires' | 'aqi' | 'purpleair'

const AQI_LEVELS: { level: AqiLevel; label: string; range: string }[] = [
  { level: 'good', label: 'Good', range: '0–50' },
  { level: 'moderate', label: 'Moderate', range: '51–100' },
  { level: 'sensitive', label: 'Unhealthy for sensitive groups', range: '101–150' },
  { level: 'unhealthy', label: 'Unhealthy', range: '151–200' },
  { level: 'veryunhealthy', label: 'Very unhealthy', range: '201–300' },
  { level: 'hazardous', label: 'Hazardous', range: '301+' }
]

const SMOKE_LEVELS: { density: SmokeDensity; label: string; color: string }[] = [
  { density: 'light', label: 'Light smoke', color: '#8B8A82' },
  { density: 'medium', label: 'Medium smoke', color: '#57564F' },
  { density: 'heavy', label: 'Heavy smoke', color: '#1A1A18' }
]

const LAYER_COPY: Record<Layer, { title: string }> = {
  smoke: { title: 'Smoke density' },
  fires: { title: 'Fire detections' },
  aqi: { title: 'Air Quality Index' },
  purpleair: { title: 'PurpleAir sensors' }
}

export default function MapLegend({ activeLayer }: { activeLayer: Layer }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="absolute bottom-3 left-3 z-[1200] max-w-[220px]">
      {isOpen && (
        <div className="mb-1.5 bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 rounded-lg shadow-lg p-3 max-h-[260px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0">
              {LAYER_COPY[activeLayer].title}
            </p>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close legend"
              className="text-ink-400 dark:text-night-400 text-sm leading-none"
            >
              ✕
            </button>
          </div>

          {activeLayer === 'aqi' && (
            <>
              <div className="flex flex-col gap-1 mb-2.5">
                {AQI_LEVELS.map((item) => (
                  <div key={item.level} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: aqiColor[item.level] }}
                    />
                    <span className="text-[11px] text-ink-600 dark:text-night-200 flex-1">{item.label}</span>
                    <span className="text-[11px] text-ink-400 dark:text-night-400">{item.range}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-ink-200 dark:border-night-600">
                <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
                  <strong className="text-ink-900 dark:text-night-100">AQI</strong> (Air Quality Index) turns
                  pollution measurements into one 0–500 number so air quality is easy to compare day to
                  day — lower is better.
                </p>
              </div>
            </>
          )}

          {activeLayer === 'purpleair' && (
            <>
              <div className="flex flex-col gap-1 mb-2.5">
                {AQI_LEVELS.map((item) => (
                  <div key={item.level} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: aqiColor[item.level] }}
                    />
                    <span className="text-[11px] text-ink-600 dark:text-night-200 flex-1">{item.label}</span>
                    <span className="text-[11px] text-ink-400 dark:text-night-400">{item.range}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-ink-200 dark:border-night-600">
                <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
                  <strong className="text-ink-900 dark:text-night-100">PM2.5</strong> refers to fine
                  particles small enough to reach deep into the lungs. These sensors measure PM2.5
                  directly; readings are corrected for smoke before converting to the AQI colors shown
                  above, since raw sensor values run high in smoke.
                </p>
              </div>
            </>
          )}

          {activeLayer === 'smoke' && (
            <>
              <div className="flex flex-col gap-1 mb-2.5">
                {SMOKE_LEVELS.map((item) => (
                  <div key={item.density} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] text-ink-600 dark:text-night-200">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-ink-200 dark:border-night-600">
                <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
                  Smoke density comes from NOAA's satellite smoke-detection feed — it shows where
                  plumes are visible from space, not a ground-level pollution reading.
                </p>
              </div>
            </>
          )}

          {activeLayer === 'fires' && (
            <>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#C24545' }} />
                <span className="text-[11px] text-ink-600 dark:text-night-200">Satellite-detected fire</span>
              </div>
              <div className="pt-2 border-t border-ink-200 dark:border-night-600">
                <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
                  Each point is a raw satellite heat detection (e.g. "Fire detected (Suomi NPP)"), not
                  an official or human-assigned fire name — the feed doesn't provide those.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 rounded-full px-2.5 py-1 shadow-sm"
      >
        <span className="flex -space-x-0.5">
          {(activeLayer === 'aqi' || activeLayer === 'purpleair') &&
            [aqiColor.good, aqiColor.moderate, aqiColor.unhealthy].map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full border border-white dark:border-night-800" style={{ backgroundColor: c }} />
            ))}
          {activeLayer === 'smoke' &&
            SMOKE_LEVELS.map((item) => (
              <span key={item.density} className="w-2 h-2 rounded-full border border-white dark:border-night-800" style={{ backgroundColor: item.color }} />
            ))}
          {activeLayer === 'fires' && (
            <span className="w-2 h-2 rounded-full border border-white dark:border-night-800" style={{ backgroundColor: '#C24545' }} />
          )}
        </span>
        <span className="text-[11px] text-ink-600 dark:text-night-200">Legend</span>
      </button>
    </div>
  )
}
