export type ScreenId =
  | 'home'
  | 'activity'
  | 'outdoorAir'
  | 'myActivities'
  | 'groups'
  | 'indoorAir'
  | 'events'
  | 'settings'
  | 'settingsProfile'
  | 'settingsHealthProfile'
  | 'settingsAutoTrack'
  | 'settingsSensors'
  | 'settingsLocations'
  | 'settingsConnections'
  | 'settingsNotifications'
  | 'settingsCommunication'
  | 'paywall'

interface MenuItem {
  id: ScreenId
  label: string
  icon: JSX.Element
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'myActivities',
    label: 'My activities',
    icon: <path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" />
  },
  {
    id: 'groups',
    label: 'Groups',
    icon: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    )
  },
  {
    id: 'indoorAir',
    label: 'Indoor air',
    icon: <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />
  },
  {
    id: 'events',
    label: 'Events',
    icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    )
  }
]

interface HamburgerMenuProps {
  open: boolean
  active: ScreenId
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
}

/**
 * Slide-in drawer navigation, replacing the old bottom tab bar to match
 * the reference app's structure: a hamburger icon in the header opens a
 * panel from the right with the app's main sections as a menu list,
 * rather than 5 always-visible bottom tabs.
 */
export default function HamburgerMenu({ open, active, onClose, onNavigate }: HamburgerMenuProps) {
  return (
    <>
      {/* Dimmed backdrop — tapping it closes the menu, matching the
          reference's overlay behind the slide-in panel. Sits above all
          screen content (z-40) but below the panel itself (z-50). */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`absolute inset-0 z-40 bg-black/40 transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <div
        className={`absolute top-0 right-0 bottom-0 z-50 w-[78%] max-w-[300px] bg-white dark:bg-night-800 shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 pt-6 pb-2">
          <p className="text-xs font-medium tracking-wide text-ink-400 dark:text-night-400 m-0">MENU</p>
        </div>
        <div className="flex flex-col">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id)
                onClose()
              }}
              className={`flex items-center gap-3 px-5 py-3 text-left ${
                active === item.id ? 'bg-ink-100 dark:bg-night-700' : ''
              }`}
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
                  {item.icon}
                </svg>
              </span>
              <span className="text-sm font-medium text-ink-900 dark:text-night-100">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
