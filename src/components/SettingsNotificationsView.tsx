import { AlertSettings } from '../services/alertSettings'
import ScreenHeader from './ScreenHeader'
import AlertsView from './AlertsView'

interface SettingsNotificationsViewProps {
  onBack: () => void
  alertSettings: AlertSettings
  onAlertSettingsChange: (settings: AlertSettings) => void
  sensitiveProfile: boolean
  center: [number, number]
}

export default function SettingsNotificationsView({
  onBack,
  alertSettings,
  onAlertSettingsChange,
  sensitiveProfile,
  center,
}: SettingsNotificationsViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Notifications" onBack={onBack} />
      <AlertsView
        settings={alertSettings}
        onChange={onAlertSettingsChange}
        sensitiveProfile={sensitiveProfile}
        center={center}
      />
    </div>
  )
}
