import ScreenHeader from './ScreenHeader'

interface SettingsLocationsViewProps {
  onBack: () => void
}

/**
 * Honest empty state for saved/favorite locations — the reference app
 * lets you save multiple homes, gyms, etc. to track separately. Respira
 * currently tracks one active location (search or geolocation) rather
 * than a saved list, so that's flagged plainly here instead of faked.
 */
export default function SettingsLocationsView({ onBack }: SettingsLocationsViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Locations" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <button
          disabled
          className="w-full mb-4 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-ink-300 dark:bg-night-600 cursor-not-allowed"
        >
          + Add Location
        </button>
        <p className="text-xs text-ink-400 dark:text-night-400 text-center">
          No locations yet. Saved locations aren't available in this build — search a place from Outdoor
          air instead to check conditions anywhere.
        </p>
      </div>
    </div>
  )
}
