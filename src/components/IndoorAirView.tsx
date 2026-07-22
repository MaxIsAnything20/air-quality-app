import { useMemo, useState } from 'react'
import { aqiToScore, scoreLabel } from '../types'
import ScreenHeader from './ScreenHeader'

interface IndoorAirViewProps {
  onBack: () => void
  /** Live outdoor AQI (null when there's no live reading — sample data or
   * not yet loaded), used to derive the indoor estimate below. */
  outdoorAqi: number | null
}

type WindowState = 'closed' | 'open'
type PurifierState = 'off' | 'on'

// Rough indoor/outdoor PM2.5 ratios for a home with no indoor pollution
// source (cooking, smoking, candles, etc). Pulled from the general range
// building-science research reports for infiltration and HEPA filtration
// effects — centered estimates, not exact, because there's no way to know
// a specific home's real air exchange rate without an actual sensor. That
// uncertainty is exactly why this is presented as a labeled estimate
// rather than a fake precise reading.
const IO_RATIO: Record<WindowState, Record<PurifierState, number>> = {
  closed: { off: 0.4, on: 0.2 },
  open: { off: 0.9, on: 0.65 },
}

function scoreColor(score: number): string {
  if (score >= 80) return '#2F6B4F'
  if (score >= 60) return '#5B8C51'
  if (score >= 40) return '#D9922B'
  if (score >= 20) return '#C97A3B'
  return '#B3462C'
}

/**
 * AirTrack's own "Sensors" screen is just an empty state: a "buy sensors"
 * link, an "add account" button, and "no sensors set up yet" — nothing
 * happens until you own hardware. Since this app already has a live
 * outdoor AQI reading, there's a genuinely useful thing to show before
 * that point: a transparent, physically-grounded *estimate* of indoor
 * air based on outdoor conditions plus the two biggest levers a person
 * actually controls (windows, purifier) — not a substitute for a real
 * sensor, but real information instead of an empty box.
 */
export default function IndoorAirView({ onBack, outdoorAqi }: IndoorAirViewProps) {
  const [windows, setWindows] = useState<WindowState>('closed')
  const [purifier, setPurifier] = useState<PurifierState>('off')
  const [tappedSetup, setTappedSetup] = useState(false)

  const estimate = useMemo(() => {
    if (outdoorAqi == null) return null
    const ratio = IO_RATIO[windows][purifier]
    const estimatedAqi = Math.round(outdoorAqi * ratio)
    const score = aqiToScore(estimatedAqi)
    return { estimatedAqi, score, label: scoreLabel(score) }
  }, [outdoorAqi, windows, purifier])

  const tip = useMemo(() => {
    if (outdoorAqi == null) return null
    if (outdoorAqi > 100 && windows === 'open') {
      return 'Outdoor air is elevated right now — closing your windows would meaningfully lower your estimated indoor exposure.'
    }
    if (outdoorAqi > 100 && purifier === 'off') {
      return 'A HEPA purifier would cut your estimated indoor exposure roughly in half at this outdoor level.'
    }
    if (outdoorAqi <= 50 && windows === 'closed') {
      return 'Outdoor air is good right now — opening a window is a free way to refresh indoor air.'
    }
    return null
  }, [outdoorAqi, windows, purifier])

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Indoor air" onBack={onBack} />

      <div className="px-4 pt-4 pb-6">
        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 m-0">
              Estimated indoor air
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-100 dark:bg-night-700 text-ink-600 dark:text-night-200">
              No sensor connected
            </span>
          </div>

          {estimate ? (
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p
                  className="text-4xl font-semibold m-0 leading-none"
                  style={{ color: scoreColor(estimate.score) }}
                >
                  {estimate.score}%
                </p>
                <p className="text-sm text-ink-600 dark:text-night-200 m-0 mt-1">{estimate.label}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-ink-400 dark:text-night-400 m-0">Outdoor right now</p>
                <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0 mt-0.5">{outdoorAqi} AQI</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-400 dark:text-night-400 mb-4">
              No live outdoor reading available yet, so an indoor estimate can't be calculated.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-[11px] text-ink-400 dark:text-night-400 mb-1.5">Windows</p>
              <div className="flex bg-ink-100 dark:bg-night-700 rounded-full p-1">
                {(['closed', 'open'] as WindowState[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWindows(w)}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-full capitalize transition-colors ${
                      windows === w
                        ? 'bg-[#1F4D3A] dark:bg-[#0D2A1E] text-white'
                        : 'text-ink-600 dark:text-night-200'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-ink-400 dark:text-night-400 mb-1.5">Purifier</p>
              <div className="flex bg-ink-100 dark:bg-night-700 rounded-full p-1">
                {(['off', 'on'] as PurifierState[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPurifier(p)}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-full uppercase transition-colors ${
                      purifier === p
                        ? 'bg-[#1F4D3A] dark:bg-[#0D2A1E] text-white'
                        : 'text-ink-600 dark:text-night-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {tip && (
            <div className="bg-[#D9922B]/10 border border-[#D9922B]/30 rounded-xl px-3 py-2.5 mb-2">
              <p className="text-xs text-ink-900 dark:text-night-100 m-0">{tip}</p>
            </div>
          )}

          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">
            Estimated from your live outdoor air quality and typical indoor/outdoor PM2.5 ratios for a home
            without an indoor pollution source — not a measurement from your home.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4">
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Connect a real sensor</p>
          <p className="text-xs text-ink-400 dark:text-night-400 mb-3">
            Pair an indoor air monitor for live per-room readings instead of the estimate above. This is a
            Premium feature and isn't connected to any real device yet.
          </p>
          {tappedSetup ? (
            <p className="text-xs text-ink-400 dark:text-night-400 m-0">
              Sensor setup isn't available yet — this needs a connected hardware sensor to pair with.
            </p>
          ) : (
            <button
              onClick={() => setTappedSetup(true)}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#D9922B]"
            >
              Set up a sensor
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
