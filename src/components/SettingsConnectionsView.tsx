import { useState } from 'react'
import ScreenHeader from './ScreenHeader'

interface Connection {
  id: string
  label: string
  status: 'connect' | 'comingSoon'
}

// Mirrors the real app's actual integration set (Strava, Apple Health,
// Google Health Connect, with Garmin listed as coming soon) rather than
// presenting all four as equally available today.
const CONNECTIONS: Connection[] = [
  { id: 'strava', label: 'Strava', status: 'connect' },
  { id: 'appleHealth', label: 'Apple Health', status: 'connect' },
  { id: 'googleHealth', label: 'Google Health Connect', status: 'connect' },
  { id: 'garmin', label: 'Garmin', status: 'comingSoon' },
]

interface SettingsConnectionsViewProps {
  onBack: () => void
}

/**
 * Toggle-switch style list, matching the real app's App Connections
 * screen structure more closely than the old plain "Connect" button
 * layout. None of these actually reach a real account in this build —
 * tapping a toggle says so honestly instead of pretending to connect.
 */
export default function SettingsConnectionsView({ onBack }: SettingsConnectionsViewProps) {
  const [tapped, setTapped] = useState<Record<string, boolean>>({})

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="App Connections" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
          Import activities automatically from other apps. None of these are connected to a real account
          in this build yet.
        </p>
        <div className="flex flex-col gap-2">
          {CONNECTIONS.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-night-600 px-3.5 py-3"
            >
              <div>
                <p className="text-sm text-ink-900 dark:text-night-100 m-0">{c.label}</p>
                {c.status === 'comingSoon' && (
                  <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">Coming soon</p>
                )}
                {c.status === 'connect' && tapped[c.id] && (
                  <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                    Not connected in this build yet
                  </p>
                )}
              </div>
              <button
                onClick={() => c.status === 'connect' && setTapped((t) => ({ ...t, [c.id]: true }))}
                disabled={c.status === 'comingSoon'}
                aria-label={`Toggle ${c.label}`}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${
                  tapped[c.id] ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6]' : 'bg-ink-200 dark:bg-night-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    tapped[c.id] ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
