import { AlertSettings } from '../services/alertSettings'
import { HealthProfile } from '../services/profile'
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

const CONNECTIONS = [
  { id: 'strava', label: 'Strava' },
  { id: 'appleHealth', label: 'Apple Health' },
  { id: 'garmin', label: 'Garmin' },
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
              <button
                onClick={onUpgrade}
                className="text-xs font-medium text-ink-900 dark:text-night-100 underline"
              >
                Connect
              </button>
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

      <div className="px-4 py-4 border-t border-ink-200 dark:border-night-600 mt-2">
        <p className="text-xs text-ink-400 dark:text-night-400">Respira</p>
      </div>
    </div>
  )
}
