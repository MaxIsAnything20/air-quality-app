const tabs = [
  { id: 'map', label: 'Map' },
  { id: 'history', label: 'History' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'profile', label: 'Profile' }
] as const

export type TabId = (typeof tabs)[number]['id']

const icons: Record<TabId, JSX.Element> = {
  map: (
    <path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3ZM9 3v15M15 5.5v15" />
  ),
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 12V6m0 6h6" />,
  alerts: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" />,
  profile: <path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
}

interface BottomNavProps {
  active: TabId
  onChange: (tab: TabId) => void
  // Per-tab "there's something new here" indicator — e.g. a divergence
  // banner or a worsening alert the user hasn't switched to that tab to
  // see yet. Optional and defaults to none, so existing callers keep
  // working without any changes.
  badges?: Partial<Record<TabId, boolean>>
}

export default function BottomNav({ active, onChange, badges }: BottomNavProps) {
  return (
    // Green bar matches the header (see App.tsx) so the app's chrome
    // reads as one consistent branded frame top and bottom, with the
    // neutral light/dark content sandwiched in between — Respira's own
    // persistent tab bar rather than a plain transparent strip.
    <div className="flex justify-around py-2 bg-gradient-to-b from-[#1F4D3A] to-[#173D2D] dark:from-[#0D2A1E] dark:to-[#0A2118]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
            active === tab.id ? 'text-white bg-white/15' : 'text-white/55'
          }`}
        >
          <span className="relative">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {icons[tab.id]}
            </svg>
            {badges?.[tab.id] && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-aqi-unhealthy ring-2 ring-[#1F4D3A] dark:ring-[#0D2A1E]" />
            )}
          </span>
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
