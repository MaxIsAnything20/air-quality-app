import ScreenHeader from './ScreenHeader'

interface SettingsAutoTrackViewProps {
  onBack: () => void
  onUpgrade: () => void
}

/**
 * Mirrors the AutoTrack card on Home (see HomeView.tsx) — always-on
 * background tracking needs a native process that keeps running with
 * the tab closed, which a web app can't genuinely provide. Rather than
 * ship a toggle that silently does nothing once you close the tab, this
 * stays an honest Premium teaser in both places.
 */
export default function SettingsAutoTrackView({ onBack, onUpgrade }: SettingsAutoTrackViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="AutoTrack" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <div className="rounded-2xl border border-ink-200 dark:border-night-600 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">AutoTrack</p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D9922B" strokeWidth="2">
              <path d="M6 3h12l4 6-10 12L2 9Z" />
            </svg>
          </div>
          <span className="inline-block mb-3 px-3 py-1 rounded-full text-[11px] bg-ink-200 dark:bg-night-600 text-ink-600 dark:text-night-200">
            Off
          </span>
          <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
            Turn on AutoTrack to gather your exposure data 24/7, even when the app is closed. This needs a
            native background process a browser tab can't provide, so it isn't available in this build.
          </p>
          <button onClick={onUpgrade} className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#D9922B]">
            See Premium
          </button>
        </div>
      </div>
    </div>
  )
}
