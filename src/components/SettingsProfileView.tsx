import ScreenHeader from './ScreenHeader'

interface SettingsProfileViewProps {
  onBack: () => void
}

/**
 * The reference app's Profile screen shows a signed-in account (email,
 * streak, badges) because it has real server-side auth. Respira doesn't
 * have accounts at all — everything lives in this browser only — so the
 * honest equivalent is saying that plainly rather than inventing a fake
 * signed-in email to look more complete.
 */
export default function SettingsProfileView({ onBack }: SettingsProfileViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Profile" onBack={onBack} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-2">
        <span className="w-14 h-14 rounded-full bg-ink-100 dark:bg-night-700 flex items-center justify-center mb-1">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-400 dark:text-night-400">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
        </span>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">No account on this device</p>
        <p className="text-xs text-ink-400 dark:text-night-400 m-0 max-w-[240px]">
          Respira doesn't use accounts — everything you see is saved only in this browser, on this device.
        </p>
      </div>
    </div>
  )
}
