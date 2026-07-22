import { useState } from 'react'
import ScreenHeader from './ScreenHeader'

const POLLEN_TYPES = ['Tree', 'Grass', 'Weed'] as const
type PollenType = (typeof POLLEN_TYPES)[number]

const POLLEN_PREFS_KEY = 'respira.pollenPrefs.v1'

function isPollenType(value: unknown): value is PollenType {
  return typeof value === 'string' && (POLLEN_TYPES as readonly string[]).includes(value)
}

function loadPollenPrefs(): PollenType[] {
  try {
    const raw = localStorage.getItem(POLLEN_PREFS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPollenType) : []
  } catch {
    return []
  }
}

interface SettingsPollenPrefsViewProps {
  onBack: () => void
}

/**
 * Real, working local preference for which pollen types matter to you —
 * kept separate from the actual Pollen forecast (still a Premium teaser,
 * since Respira doesn't have a pollen data source connected yet) so
 * choosing preferences here doesn't imply data that isn't there.
 */
export default function SettingsPollenPrefsView({ onBack }: SettingsPollenPrefsViewProps) {
  const [selected, setSelected] = useState<PollenType[]>(loadPollenPrefs)

  function toggle(type: PollenType) {
    setSelected((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
      try {
        localStorage.setItem(POLLEN_PREFS_KEY, JSON.stringify(next))
      } catch {
        // Best-effort — localStorage may be unavailable (private mode, quota).
      }
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Pollen preferences" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
          Tell us which pollen types affect you, so a future pollen forecast can be personalized to you
          specifically instead of showing every type equally.
        </p>
        <div className="flex flex-col gap-2">
          {POLLEN_TYPES.map((type) => {
            const checked = selected.includes(type)
            return (
              <button
                key={type}
                onClick={() => toggle(type)}
                className={`flex items-center gap-2.5 text-left text-xs px-3 py-2.5 rounded-xl border transition-colors ${
                  checked
                    ? 'border-ink-900 dark:border-night-100 text-ink-900 dark:text-night-100 bg-ink-100 dark:bg-night-700'
                    : 'border-ink-200 dark:border-night-600 text-ink-600 dark:text-night-200'
                }`}
              >
                <span
                  className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${
                    checked
                      ? 'bg-ink-900 dark:bg-night-100 border-ink-900 dark:border-night-100'
                      : 'border-ink-300 dark:border-night-500'
                  }`}
                >
                  {checked && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-white dark:text-ink-900"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                {type}
              </button>
            )
          })}
        </div>
        {selected.length === 0 && (
          <p className="text-[11px] text-ink-400 dark:text-night-400 mt-4">
            Nothing selected yet — pick any that affect you.
          </p>
        )}
      </div>
    </div>
  )
}
