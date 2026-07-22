import ScreenHeader from './ScreenHeader'
import type { ScreenId } from './HamburgerMenu'

interface SettingsRow {
  id: ScreenId
  label: string
  description: string
  icon: JSX.Element
}

// Matches the real app's Settings row structure (a drill-down list, each
// row opening its own screen) rather than one long scrolling page — plus
// one extra row of our own ("Health profile") that the reference app
// doesn't have, kept here as a genuine original addition rather than a
// copy.
const ROWS: SettingsRow[] = [
  {
    id: 'settingsProfile',
    label: 'Profile',
    description: 'Account details',
    icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  },
  {
    id: 'settingsAutoTrack',
    label: 'AutoTrack',
    description: 'Background tracking & coaching',
    icon: <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />,
  },
  {
    id: 'settingsSensors',
    label: 'Sensors',
    description: 'Manage air quality sensors and accounts',
    icon: <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />,
  },
  {
    id: 'settingsLocations',
    label: 'Locations',
    description: 'Manage indoor locations',
    icon: <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  },
  {
    id: 'settingsConnections',
    label: 'App Connections',
    description: 'Apple Health & more',
    icon: <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />,
  },
  {
    id: 'settingsNotifications',
    label: 'Notifications',
    description: 'Manage notification preferences',
    icon: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" />,
  },
  {
    id: 'settingsCommunication',
    label: 'Communication',
    description: 'Marketing & privacy settings',
    icon: <path d="M4 4h16v16H4V4Zm0 0 8 8 8-8" />,
  },
  {
    id: 'settingsHealthProfile',
    label: 'Health profile',
    description: 'Conditions that affect your risk',
    icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />,
  },
]

interface SettingsViewProps {
  onBack: () => void
  onNavigate: (screen: ScreenId) => void
}

export default function SettingsView({ onBack, onNavigate }: SettingsViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Settings" onBack={onBack} />
      <div className="px-4 pt-4 pb-6 flex flex-col gap-2">
        {ROWS.map((row) => (
          <button
            key={row.id}
            onClick={() => onNavigate(row.id)}
            className="flex items-center gap-3 rounded-xl bg-ink-100 dark:bg-night-700 px-3.5 py-3 text-left"
          >
            <span className="w-9 h-9 rounded-full bg-[#1F4D3A]/10 dark:bg-[#3C8562]/20 flex items-center justify-center shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1F4D3A"
                strokeWidth="1.8"
                className="dark:stroke-[#8FC7A6]"
              >
                {row.icon}
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-ink-900 dark:text-night-100">{row.label}</span>
              <span className="block text-xs text-ink-400 dark:text-night-400 mt-0.5">{row.description}</span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-ink-300 dark:text-night-500 shrink-0"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
      <div className="px-4 py-4 border-t border-ink-200 dark:border-night-600 mt-auto">
        <p className="text-xs text-ink-400 dark:text-night-400">Respira</p>
      </div>
    </div>
  )
}
