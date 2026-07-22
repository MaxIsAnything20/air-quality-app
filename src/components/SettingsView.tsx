import { useState } from 'react'
import { AlertSettings } from '../services/alertSettings'
import { HealthProfile } from '../services/profile'
import { clearAllLocalData } from '../services/resetData'
import ScreenHeader from './ScreenHeader'
import ProfileView from './ProfileView'
import AlertsView from './AlertsView'

interface SettingsViewProps {
  onBack: () => void
  onUpgrade: () => void
  profile: HealthProfile
  onProfileChange: (profile: HealthProfile) => void
  alertSettings: AlertSettings
  onAlertSettingsChange: (settings: AlertSettings) => void
  sensitiveProfile: boolean
  center: [number, number]
}

// Mirrors the real app's actual integration set (Strava, Apple Health,
// Google Health Connect, with Garmin listed as coming soon) rather than
// presenting all four as equally available today.
const CONNECTIONS: { id: string; label: string; status: 'connect' | 'comingSoon' }[] = [
  { id: 'strava', label: 'Strava', status: 'connect' },
  { id: 'appleHealth', label: 'Apple Health', status: 'connect' },
  { id: 'googleHealth', label: 'Google Health Connect', status: 'connect' },
  { id: 'garmin', label: 'Garmin', status: 'comingSoon' },
]

export default function SettingsView({
  onBack,
  onUpgrade,
  profile,
  onProfileChange,
  alertSettings,
  onAlertSettingsChange,
  sensitiveProfile,
  center,
}: SettingsViewProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)

  function handleClearData() {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    clearAllLocalData()
    window.location.reload()
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-night-900">
      <ScreenHeader title="Settings" onBack={onBack} />

      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 mb-2">
          Connections
        </h2>
        <p className="text-xs text-ink-600 dark:text-night-200 mb-3">
          Import activities automatically from other apps. This is a Premium feature and isn't
          connected to any real account yet.
        </p>
        <div className="flex flex-col gap-2">
          {CONNECTIONS.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-night-600 px-3.5 py-2.5"
            >
              <span className="text-sm text-ink-900 dark:text-night-100">{c.label}</span>
              {c.status === 'comingSoon' ? (
                <span className="text-xs text-ink-400 dark:text-night-400">Coming soon</span>
              ) : (
                <button
                  onClick={onUpgrade}
                  className="text-xs font-medium text-ink-900 dark:text-night-100 underline"
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-ink-200 dark:border-night-600 mt-2">
        <ProfileView profile={profile} onChange={onProfileChange} />
      </div>

      <div className="border-t border-ink-200 dark:border-night-600">
        <AlertsView
          settings={alertSettings}
          onChange={onAlertSettingsChange}
          sensitiveProfile={sensitiveProfile}
          center={center}
        />
      </div>

      {/* The local equivalent of "Delete Account" — this app has no
          server-side account, so there's nothing to delete remotely.
          What's real and honest to offer instead is wiping the data
          that actually exists: everything saved in this browser. */}
      <div className="px-4 py-4 border-t border-ink-200 dark:border-night-600 mt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 mb-2">
          Data & privacy
        </h2>
        <p className="text-xs text-ink-600 dark:text-night-200 mb-3">
          Activities, your health profile, and alert preferences are stored only on this device —
          there's no account on a server to delete. Clearing your data here removes it completely
          and immediately.
        </p>
        <button
          onClick={handleClearData}
          className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
            confirmingClear
              ? 'bg-aqi-unhealthy text-white'
              : 'border border-ink-200 dark:border-night-600 text-ink-900 dark:text-night-100'
          }`}
        >
          {confirmingClear ? 'Tap again to permanently clear all data' : 'Clear my data'}
        </button>
      </div>

      <div className="px-4 py-4 border-t border-ink-200 dark:border-night-600">
        <p className="text-xs text-ink-400 dark:text-night-400">Respira</p>
      </div>
    </div>
  )
}
