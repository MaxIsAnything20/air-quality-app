import { useRef, useState } from 'react'

interface PaywallViewProps {
  onBack: () => void
}

type Plan = 'monthly' | 'yearly'

interface FeaturePage {
  icon: JSX.Element
  title: string
  features: string[]
}

// Mirrors the real feature set of AirTrack's actual Premium tier —
// 24/7 automatic tracking, multi-day forecasts, multi-pollutant
// tracking, unlimited route planning, leaderboards, richer
// notifications — described in this app's own words rather than
// reusing their marketing copy. Grouped into swipeable pages (matching
// the reference app's own multi-page paywall with a dot indicator)
// instead of one long static list.
const PAGES: FeaturePage[] = [
  {
    title: 'Track everywhere',
    icon: <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />,
    features: [
      'Automatic 24/7 exposure tracking, indoors and outdoors',
      '4-day air quality forecasts',
    ],
  },
  {
    title: 'See the full picture',
    icon: <path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" />,
    features: [
      'Unlimited cleaner route and timing suggestions',
      'PM2.5, PM10, NO2, O3 and SO2 tracked, not just one number',
    ],
  },
  {
    title: 'Stay in the loop',
    icon: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" />,
    features: [
      'Create leaderboards to challenge friends and groups',
      'Daily and post-activity notifications',
    ],
  },
]

export default function PaywallView({ onBack }: PaywallViewProps) {
  const [plan, setPlan] = useState<Plan>('yearly')
  const [showNotice, setShowNotice] = useState(false)
  const [page, setPage] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)

  function goToPage(index: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    setPage(index)
  }

  function handleScroll() {
    const el = scrollerRef.current
    if (!el || el.clientWidth === 0) return
    const next = Math.round(el.scrollLeft / el.clientWidth)
    if (next !== page) setPage(next)
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-night-900">
      <div className="relative bg-gradient-to-b from-[#1F4D3A] to-[#173D2D] dark:from-[#0D2A1E] dark:to-[#0A2118] px-4 pt-4 pb-6">
        <button
          onClick={onBack}
          aria-label="Close"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-[#D9922B] uppercase mb-1">Respira Premium</p>
          <h1 className="text-2xl font-semibold text-white m-0">Breathe with more confidence</h1>
          <p className="text-sm text-white/70 mt-2">
            Unlock automatic tracking, cleaner routes, and deeper air quality insight.
          </p>
        </div>
      </div>

      {/* Swipeable feature pages — matches the reference app's own
          multi-page paywall carousel with a dot indicator, rather than
          one long static feature list. Native horizontal scroll-snap
          instead of a JS drag library, so it works with touch, mouse
          drag, and trackpad swipe without any extra dependency. */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory paywall-scroller"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`.paywall-scroller::-webkit-scrollbar { display: none; }`}</style>
        {PAGES.map((p) => (
          <div key={p.title} className="w-full shrink-0 snap-center px-4 pt-5 pb-3">
            <div className="flex items-center gap-2.5 mb-3">
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
                  {p.icon}
                </svg>
              </span>
              <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">{p.title}</h2>
            </div>
            <ul className="flex flex-col gap-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#D9922B]/15 flex items-center justify-center mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D9922B" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="text-sm text-ink-900 dark:text-night-100">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-4">
        {PAGES.map((p, i) => (
          <button
            key={p.title}
            onClick={() => goToPage(i)}
            aria-label={`Go to page ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === page ? 'w-5 bg-[#1F4D3A] dark:bg-[#8FC7A6]' : 'w-1.5 bg-ink-200 dark:bg-night-600'
            }`}
          />
        ))}
      </div>

      <div className="px-4 pb-5 border-t border-ink-200 dark:border-night-600 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setPlan('monthly')}
            className={`text-left rounded-2xl border px-4 py-3.5 transition-colors ${
              plan === 'monthly'
                ? 'border-ink-900 dark:border-night-100 bg-ink-100 dark:bg-night-700'
                : 'border-ink-200 dark:border-night-600'
            }`}
          >
            <p className="text-xs text-ink-400 dark:text-night-400 mb-1">Monthly</p>
            <p className="text-lg font-semibold text-ink-900 dark:text-night-100 m-0">$4.99</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 mt-0.5">per month</p>
          </button>
          <button
            onClick={() => setPlan('yearly')}
            className={`relative text-left rounded-2xl border px-4 py-3.5 transition-colors ${
              plan === 'yearly'
                ? 'border-ink-900 dark:border-night-100 bg-ink-100 dark:bg-night-700'
                : 'border-ink-200 dark:border-night-600'
            }`}
          >
            <span className="absolute -top-2 right-3 text-[10px] font-semibold bg-[#D9922B] text-white px-2 py-0.5 rounded-full">
              Save 33%
            </span>
            <p className="text-xs text-ink-400 dark:text-night-400 mb-1">Yearly</p>
            <p className="text-lg font-semibold text-ink-900 dark:text-night-100 m-0">$39.99</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 mt-0.5">per year</p>
          </button>
        </div>

        <p className="text-xs text-ink-600 dark:text-night-200 mb-4 text-center">7-day free trial, cancel anytime.</p>

        <button
          onClick={() => setShowNotice(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] text-white text-sm font-medium py-3.5"
        >
          Start free trial — {plan === 'monthly' ? 'Monthly' : 'Yearly'}
        </button>

        {showNotice && (
          <p className="text-xs text-ink-400 dark:text-night-400 mt-3 text-center">
            This is a UI preview — billing isn't set up, so nothing was charged.
          </p>
        )}

        <p className="text-[11px] text-ink-400 dark:text-night-400 mt-4 text-center">
          Prices shown for illustration only.
        </p>
      </div>
    </div>
  )
}
