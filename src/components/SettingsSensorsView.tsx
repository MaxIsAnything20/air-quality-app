import { useState } from 'react'
import ScreenHeader from './ScreenHeader'

interface SettingsSensorsViewProps {
  onBack: () => void
}

/**
 * Recreates the reference app's real Sensors screen structure (buy
 * sensors / add a sensor account / empty list) rather than the inline
 * card that used to live at the bottom of Indoor Air — this is now the
 * one canonical place sensor setup lives, and Indoor Air links here
 * instead of duplicating the same button.
 */
export default function SettingsSensorsView({ onBack }: SettingsSensorsViewProps) {
  const [tappedSetup, setTappedSetup] = useState(false)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Sensors" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4 mb-3">
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Buy air quality sensors</p>
          <p className="text-xs text-ink-400 dark:text-night-400 m-0">
            Pair hardware for live per-room indoor readings. Respira doesn't sell sensors itself — any
            monitor that exposes a public API could be connected here in a future build.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4 mb-3">
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Add sensor account</p>
          <p className="text-xs text-ink-400 dark:text-night-400 mb-3">
            Connect a sensor manufacturer's account to pull in live readings automatically.
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
              + Add sensor account
            </button>
          )}
        </div>

        <p className="text-xs text-ink-400 dark:text-night-400 text-center mt-4">
          No sensors set up yet. In the meantime, Indoor air shows a live estimate based on outdoor
          conditions instead of an empty screen.
        </p>
      </div>
    </div>
  )
}
