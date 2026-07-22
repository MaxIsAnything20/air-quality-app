import { useState } from 'react'

interface PaywallViewProps {
  onBack: () => void
}

type Plan = 'monthly' | 'yearly'

// Mirrors the real feature set of AirTrack's actual Premium tier —
// 24/7 automatic tracking, multi-day forecasts, multi-pollutant
// tracking, unlimited route planning, leaderboards, richer
// notifications — described in this app's own words rather than
// reusing their marketing copy.
const FEATURES = [
  'Automatic 24/7 exposure tracking, indoors and outdoors',
    '4-day air quality forecasts',
  'Unlimited cleaner route and timing suggestions',
  'PM2.5, PM10, NO2, O3 and SO2 tracked, not just one number',
  'Create leaderboards to challenge friends and groups',
  'Daily and post-activity notifications',
]

export default function PaywallView({ onBack }: PaywallViewProps) {
  const [plan, setPlan] = useState<Plan>('yearly')
  const [showNotice, setShowNotice] = useState(false)

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-night-900">
      <div className="relative bg-gradient-to-b from-[#1F4D3A] to-[#173D2D] dark:from-[#0D2A1E] dark:to-[#0A2118] px-4 pt-4 pb-8">
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

      <div className="px-4 py-5">
        <ul className="flex flex-col gap-3 mb-6">
          {FEATURES.map((f) => (
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
