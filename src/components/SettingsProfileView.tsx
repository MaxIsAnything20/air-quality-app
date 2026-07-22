import ScreenHeader from './ScreenHeader'

interface SettingsProfileViewProps {
  onBack: () => void
  streak: number
  badgeEarned: boolean
  eventBadgeEarned: boolean
}

function BadgeRow({
  earned,
  label,
  unearnedDescription,
}: {
  earned: boolean
  label: string
  unearnedDescription: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ${
        earned ? 'bg-[#1F4D3A]/10 dark:bg-[#3C8562]/20' : 'bg-ink-100 dark:bg-night-700'
      }`}
    >
      <span
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          earned ? 'bg-[#D9922B]' : 'bg-ink-200 dark:bg-night-600'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={earned ? 'white' : 'currentColor'}
          strokeWidth="1.8"
          className={earned ? '' : 'text-ink-400 dark:text-night-400'}
        >
          <path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">{label}</p>
        <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
          {earned ? 'Unlocked' : unearnedDescription}
        </p>
      </div>
    </div>
  )
}

/**
 * The reference app's Profile screen shows a signed-in account (email,
 * streak, badges) because it has real server-side auth. Respira doesn't
 * have accounts at all — everything lives in this browser only — so the
 * honest equivalent keeps that fact front and center, while still
 * showing a real streak and badge state computed from actually-logged
 * activities and event check-ins (see services/streak.ts) rather than
 * inventing either.
 */
export default function SettingsProfileView({ onBack, streak, badgeEarned, eventBadgeEarned }: SettingsProfileViewProps) {
  const totalBadges = (badgeEarned ? 1 : 0) + (eventBadgeEarned ? 1 : 0)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Profile" onBack={onBack} />

      <div className="px-4 pt-4 pb-6">
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="bg-ink-100 dark:bg-night-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-semibold text-ink-900 dark:text-night-100 m-0">{streak}</p>
            <p className="text-xs text-ink-600 dark:text-night-200 m-0 mt-1">
              day streak{streak === 1 ? '' : 's'}
            </p>
          </div>
          <div className="bg-ink-100 dark:bg-night-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-semibold text-ink-900 dark:text-night-100 m-0">{totalBadges}</p>
            <p className="text-xs text-ink-600 dark:text-night-200 m-0 mt-1">
              badge{totalBadges === 1 ? '' : 's'} earned
            </p>
          </div>
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 mb-2">
          Badges
        </h2>
        <div className="space-y-2 mb-6">
          <BadgeRow
            earned={badgeEarned}
            label="First activity"
            unearnedDescription="Complete your first tracked activity to unlock"
          />
          <BadgeRow
            earned={eventBadgeEarned}
            label="Event check-in"
            unearnedDescription="Check in to your first event to unlock"
          />
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 mb-2">
          Account
        </h2>
        <div className="flex items-center gap-3 rounded-xl bg-ink-100 dark:bg-night-700 px-3.5 py-3">
          <span className="w-9 h-9 rounded-full bg-ink-200 dark:bg-night-600 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-400 dark:text-night-400">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">No account on this device</p>
            <p className="text-xs text-ink-400 dark:text-night-400 m-0 mt-0.5 max-w-[240px]">
              Respira doesn't use accounts — everything you see is saved only in this browser, on this device.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
