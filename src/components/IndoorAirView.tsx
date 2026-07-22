import { useState } from 'react'
import ScreenHeader from './ScreenHeader'

interface IndoorAirViewProps {
  onBack: () => void
}

/**
 * Indoor air quality needs a connected hardware sensor (e.g. a Purple Air
 * indoor unit or similar) — there's nothing to build here yet without a
 * real device to pair with. The "Set up a sensor" button acknowledges
 * that rather than silently doing nothing when tapped.
 */
export default function IndoorAirView({ onBack }: IndoorAirViewProps) {
  const [tappedSetup, setTappedSetup] = useState(false)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Indoor air quality" onBack={onBack} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
        <span className="w-14 h-14 rounded-full bg-ink-100 dark:bg-night-700 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-400 dark:text-night-400">
            <rect x="6" y="6" width="12" height="12" rx="2" />
            <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
          </svg>
        </span>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">No indoor sensors yet.</p>
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          Connect a sensor to see your indoor air quality.
        </p>

        {tappedSetup ? (
          <p className="text-xs text-ink-400 dark:text-night-400 m-0 mt-1">
            Indoor sensor setup isn't available yet — this needs a connected hardware sensor to pair with.
          </p>
        ) : (
          <button
            onClick={() => setTappedSetup(true)}
            className="mt-1 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#D9922B]"
          >
            Set up a sensor
          </button>
        )}
      </div>
    </div>
  )
}
