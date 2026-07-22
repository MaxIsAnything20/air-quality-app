import { useEffect, useState } from 'react'
import ScreenHeader from './ScreenHeader'
import { connectStrava, disconnectStrava, getStravaStatus, type StravaStatus } from '../services/strava'

interface Connection {
    id: string
    label: string
    status: 'connect' | 'comingSoon' | 'live'
}

// Mirrors the real app's actual integration set (Strava, Apple Health,
// Google Health Connect, with Garmin listed as coming soon) rather than
// presenting all four as equally available today. Strava is the one of
// these that's actually buildable for a web app -- Apple Health and
// Google Health Connect are native-only APIs with no web equivalent, so
// they stay honest "connect" stubs below.
const CONNECTIONS: Connection[] = [
  { id: 'strava', label: 'Strava', status: 'live' },
  { id: 'appleHealth', label: 'Apple Health', status: 'connect' },
  { id: 'googleHealth', label: 'Google Health Connect', status: 'connect' },
  { id: 'garmin', label: 'Garmin', status: 'comingSoon' },
  ]

interface SettingsConnectionsViewProps {
    onBack: () => void
}

/**
 * Toggle-switch style list, matching the real app's App Connections
 * screen structure. Strava is wired to a real OAuth flow (see
 * api/strava/*.ts and src/services/strava.ts) -- toggling it navigates to
 * Strava's consent screen and, on approval, comes back connected. Apple
 * Health and Google Health Connect stay honest stubs since neither has a
 * web API this app could call.
 */
export default function SettingsConnectionsView({ onBack }: SettingsConnectionsViewProps) {
    const [tapped, setTapped] = useState<Record<string, boolean>>({})
    const [strava, setStrava] = useState<StravaStatus | null>(null)
    const [stravaBusy, setStravaBusy] = useState(false)
    const [stravaError, setStravaError] = useState<string | null>(null)

  useEffect(() => {
        getStravaStatus().then(setStrava)

                // Pick up the redirect back from /api/strava/callback and clean the
                // query string so refreshing the page doesn't re-trigger this.
                const params = new URLSearchParams(window.location.search)
        let changed = false
        if (params.has('stravaConnected')) {
                getStravaStatus().then(setStrava)
                params.delete('stravaConnected')
                changed = true
        }
        if (params.has('stravaError')) {
                setStravaError(params.get('stravaError'))
                params.delete('stravaError')
                changed = true
        }
        if (changed) {
                const query = params.toString()
                window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
        }
  }, [])

  async function handleStravaToggle() {
        if (strava?.connected) {
                setStravaBusy(true)
                await disconnectStrava()
                setStrava({ connected: false, athlete: null })
                setStravaBusy(false)
        } else {
                connectStrava()
        }
  }

  return (
        <div className="flex-1 flex flex-col overflow-y-auto">
              <ScreenHeader title="App Connections" onBack={onBack} />
              <div className="px-4 pt-4 pb-6">
                      <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
                                Import activities automatically from other apps.
                      </p>
                {stravaError && (
                    <p className="text-xs text-aqi-unhealthy mb-3">
                                Strava connection failed ({stravaError}). Try again.
                    </p>
                      )}
                      <div className="flex flex-col gap-2">
                        {CONNECTIONS.map((c) => {
                      const isStrava = c.id === 'strava'
                                    const isOn = isStrava ? !!strava?.connected : !!tapped[c.id]
                                                  return (
                                                                  <div
                                                                                    key={c.id}
                                                                                    className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-night-600 px-3.5 py-3"
                                                                                  >
                                                                                  <div>
                                                                                                    <p className="text-sm text-ink-900 dark:text-night-100 m-0">{c.label}</p>
                                                                                    {c.status === 'comingSoon' && (
                                                                                                        <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">Coming soon</p>
                                                                                                    )}
                                                                                    {isStrava && strava?.connected && strava.athlete && (
                                                                                                        <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                                                                                                                              Connected as {strava.athlete.firstname} {strava.athlete.lastname}
                                                                                                          </p>
                                                                                                    )}
                                                                                    {isStrava && strava && !strava.connected && (
                                                                                                        <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">Not connected</p>
                                                                                                    )}
                                                                                    {!isStrava && c.status === 'connect' && tapped[c.id] && (
                                                                                                        <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                                                                                                                              Not connected in this build yet
                                                                                                          </p>
                                                                                                    )}
                                                                                  </div>
                                                                                  <button
                                                                                                      onClick={() => {
                                                                                                                            if (isStrava) {
                                                                                                                                                    handleStravaToggle()
                                                                                                                              } else if (c.status === 'connect') {
                                                                                                                                                    setTapped((t) => ({ ...t, [c.id]: true }))
                                                                                                                              }
                                                                                                        }}
                                                                                                      disabled={c.status === 'comingSoon' || (isStrava && stravaBusy)}
                                                                                                      aria-label={`Toggle ${c.label}`}
                                                                                                      className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${
                                                                                                                            isOn ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6]' : 'bg-ink-200 dark:bg-night-600'
                                                                                                        }`}
                                                                                                    >
                                                                                                    <span
                                                                                                                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                                                                                                                                  isOn ? 'translate-x-5' : ''
                                                                                                                            }`}
                                                                                                                        />
                                                                                  </button>
                                                                  </div>
                                                                )
                        })}
                      </div>
              </div>
        </div>
      )
}
