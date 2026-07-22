import { useEffect, useMemo, useState } from 'react'
import { aqiLevelFromValue, aqiToScore, scoreLabel } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'
import ScreenHeader from './ScreenHeader'
import {
  getRecentDailySlots,
  getTodayHourlySlots,
  recordIndoorEstimate,
  type IndoorDaySlot,
  type IndoorHourSlot,
} from '../services/indoorAirLog'

interface IndoorAirViewProps {
  onBack: () => void
  /** Live outdoor AQI (null when there's no live reading — sample data or
   * not yet loaded), used to derive the indoor estimate below. */
  outdoorAqi: number | null
  /** Routes to Settings > Sensors, the one canonical place sensor setup
   * now lives, instead of duplicating that button here too. */
  onManageSensors: () => void
}

type WindowState = 'closed' | 'open'
type PurifierState = 'off' | 'on'
type HistoryTab = 'day' | 'week' | 'month'

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

function formatHourTick(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function weekdayShort(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

function monthDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/** One shared bar-chart shape for the Day/Week/Month tabs below — each
 * slot is either a real logged estimate (colored by AQI category, like
 * every other AQI chart in this app) or unlogged (flat gray, same
 * "gaps are real gaps, not fabricated Good days" convention as
 * HistoryView's monthly chart). */
interface ChartSlot {
  key: string
  aqi: number | null
  tickLabel: string | null
  tooltipLabel: string
}

function EstimateHistoryChart({ slots }: { slots: ChartSlot[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const loggedAqis = slots.map((s) => s.aqi).filter((v): v is number => v != null)
  const hasAnyData = loggedAqis.length > 0
  const selected = slots.find((s) => s.key === selectedKey) ?? null

  if (!hasAnyData) {
    return (
      <p className="text-xs text-ink-400 dark:text-night-400 text-center py-8 m-0">
        No indoor estimates logged yet for this range — open this screen a few times over the day
        to start building history.
      </p>
    )
  }

  return (
    <>
      <div className="flex items-end gap-[3px] h-28 mb-1.5">
        {slots.map((slot) => {
          if (slot.aqi == null) {
            return (
              <div
                key={slot.key}
                className="flex-1 rounded-sm min-w-[3px] h-[6%] bg-ink-200 dark:bg-night-600"
                title={`${slot.tooltipLabel}: not logged`}
              />
            )
          }
          const score = aqiToScore(slot.aqi)
          const level = aqiLevelFromValue(slot.aqi)
          const isSelected = slot.key === selectedKey
          return (
            <button
              key={slot.key}
              onClick={() => setSelectedKey(slot.key)}
              aria-label={`${slot.tooltipLabel}: ${score}%`}
              className="flex-1 h-full flex flex-col items-center justify-end relative min-w-[3px]"
            >
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${Math.max(6, score)}%`,
                  backgroundColor: aqiColor[level],
                  opacity: isSelected ? 1 : 0.8,
                  boxShadow: isSelected ? '0 0 0 2px #1F4D3A' : undefined,
                }}
              />
            </button>
          )
        })}
      </div>

      <div className="flex justify-between mb-2">
        {slots.map((slot) =>
          slot.tickLabel ? (
            <span key={slot.key} className="text-[10px] text-ink-400 dark:text-night-400">
              {slot.tickLabel}
            </span>
          ) : null
        )}
      </div>

      {selected && selected.aqi != null && (
        <div
          className="rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white mb-1"
          style={{ backgroundColor: aqiColor[aqiLevelFromValue(selected.aqi)] }}
        >
          <span className="text-xs font-medium">{selected.tooltipLabel}</span>
          <span className="text-xs font-medium">
            {scoreLabel(aqiToScore(selected.aqi))} {aqiToScore(selected.aqi)}%
          </span>
        </div>
      )}

      <p className="text-[11px] text-ink-400 dark:text-night-400 m-0">
        Bar color matches the estimate's AQI category ({aqiLevelLabel.good}, {aqiLevelLabel.moderate}, …). Gray
        bars are gaps — the app wasn't open then, so nothing was logged.
      </p>
    </>
  )
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
 *
 * Below the live estimate, a Day/Week/Month history chart is built from
 * src/services/indoorAirLog.ts, which logs a snapshot of this computed
 * estimate every time it changes (throttled) — so returning users can see
 * a trend, not just a single live number.
 */
export default function IndoorAirView({ onBack, outdoorAqi, onManageSensors }: IndoorAirViewProps) {
  const [windows, setWindows] = useState<WindowState>('closed')
  const [purifier, setPurifier] = useState<PurifierState>('off')
  const [historyTab, setHistoryTab] = useState<HistoryTab>('day')

  const estimate = useMemo(() => {
    if (outdoorAqi == null) return null
    const ratio = IO_RATIO[windows][purifier]
    const estimatedAqi = Math.round(outdoorAqi * ratio)
    const score = aqiToScore(estimatedAqi)
    return { estimatedAqi, score, label: scoreLabel(score) }
  }, [outdoorAqi, windows, purifier])

  // Log a snapshot whenever a fresh estimate is available — recordIndoorEstimate
  // itself throttles how often a point actually gets written, so this can
  // safely fire on every windows/purifier toggle without flooding storage.
  useEffect(() => {
    if (estimate) recordIndoorEstimate(estimate.estimatedAqi)
  }, [estimate])

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

  const daySlots: ChartSlot[] = useMemo(() => {
    const hourly: IndoorHourSlot[] = getTodayHourlySlots()
    return hourly.map((h) => ({
      key: `h${h.hour}`,
      aqi: h.aqi,
      tickLabel: h.hour % 6 === 0 ? formatHourTick(h.hour) : null,
      tooltipLabel: formatHourTick(h.hour),
    }))
  }, [historyTab === 'day' ? estimate : null])

  const weekSlots: ChartSlot[] = useMemo(() => {
    const daily: IndoorDaySlot[] = getRecentDailySlots(7)
    return daily.map((d) => ({
      key: d.date,
      aqi: d.aqi,
      tickLabel: weekdayShort(d.date),
      tooltipLabel: monthDayLabel(d.date),
    }))
  }, [historyTab === 'week' ? estimate : null])

  const monthSlots: ChartSlot[] = useMemo(() => {
    const daily: IndoorDaySlot[] = getRecentDailySlots(30)
    return daily.map((d, i) => ({
      key: d.date,
      aqi: d.aqi,
      tickLabel: i === 0 || i === daily.length - 1 ? monthDayLabel(d.date) : null,
      tooltipLabel: monthDayLabel(d.date),
    }))
  }, [historyTab === 'month' ? estimate : null])

  const activeSlots = historyTab === 'day' ? daySlots : historyTab === 'week' ? weekSlots : monthSlots

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

        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 m-0 mb-3">
            Estimate history
          </p>

          <div className="flex bg-ink-100 dark:bg-night-700 rounded-full p-1 mb-4">
            {(['day', 'week', 'month'] as HistoryTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setHistoryTab(tab)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-full capitalize transition-colors ${
                  historyTab === tab
                    ? 'bg-[#1F4D3A] dark:bg-[#0D2A1E] text-white'
                    : 'text-ink-600 dark:text-night-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <EstimateHistoryChart slots={activeSlots} />
        </div>

        <button
          onClick={onManageSensors}
          className="w-full rounded-2xl border border-ink-200 dark:border-night-600 p-4 text-left"
        >
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Connect a real sensor</p>
          <p className="text-xs text-ink-400 dark:text-night-400 m-0">
            Pair an indoor air monitor for live per-room readings instead of the estimate above. Manage
            sensors in Settings.
          </p>
        </button>
      </div>
    </div>
  )
}
