import ScreenHeader from './ScreenHeader'

interface GroupsViewProps {
  onBack: () => void
}

/**
 * Groups is a social/comparison feature (leaderboards you join or create
 * to compare your score with friends) that has no backend yet — this is
 * a UI-only placeholder matching the empty state you'd see before
 * joining or creating one, not a stubbed-out real feature pretending
 * to work.
 */
export default function GroupsView({ onBack }: GroupsViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Groups" onBack={onBack} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
        <span className="w-14 h-14 rounded-full bg-ink-100 dark:bg-night-700 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-400 dark:text-night-400">
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">No leaderboards yet</p>
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          Join a leaderboard to compare your score with friends, or create your own to challenge a
          group.
        </p>
      </div>
    </div>
  )
}
