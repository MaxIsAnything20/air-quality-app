import ScreenHeader from './ScreenHeader'

interface PollenViewProps {
  onBack: () => void
  onUpgrade: () => void
}

/**
 * Pollen forecasts are a Premium feature in the reference app (shown
 * blurred/locked on the home card) and there's no pollen data source
 * wired in yet either way — so this is an honest "upgrade to unlock"
 * teaser rather than fabricated pollen counts.
 */
export default function PollenView({ onBack, onUpgrade }: PollenViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Pollen" onBack={onBack} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
        <span className="w-14 h-14 rounded-full bg-[#D9922B]/10 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D9922B" strokeWidth="1.8">
            <path d="M6 3h12l4 6-10 12L2 9Z" />
          </svg>
        </span>
        <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Pollen is a Premium feature</p>
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          Tree, grass, and weed pollen forecasts for your area aren't available on the free plan yet.
        </p>
        <button
          onClick={onUpgrade}
          className="mt-1 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#D9922B]"
        >
          See Premium
        </button>
      </div>
    </div>
  )
}
