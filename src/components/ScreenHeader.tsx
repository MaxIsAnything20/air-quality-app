interface ScreenHeaderProps {
  title: string
  onBack: () => void
}

/** Plain white back-arrow header used by every screen except Home, which
 * has its own green hero block instead. Matches the reference app's own
 * split: one prominent branded header on the home screen, a simple
 * back-navigation bar everywhere else. */
export default function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-200 dark:border-night-600">
      <button onClick={onBack} aria-label="Back" className="w-7 h-7 flex items-center justify-center -ml-1">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-900 dark:text-night-100">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="text-base font-medium text-ink-900 dark:text-night-100 m-0">{title}</h1>
    </div>
  )
}
