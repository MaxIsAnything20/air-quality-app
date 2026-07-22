import { useState } from 'react'
import { clearAllLocalData } from '../services/resetData'
import ScreenHeader from './ScreenHeader'

const EMAIL_UPDATES_KEY = 'respira.emailUpdates.v1'

function loadEmailUpdates(): boolean {
  try {
    return localStorage.getItem(EMAIL_UPDATES_KEY) === 'true'
  } catch {
    return false
  }
}

interface SettingsCommunicationViewProps {
  onBack: () => void
}

/**
 * Groups the reference app's "Communication" preferences with the
 * privacy controls they naturally imply — Respira has no email or push
 * server to send marketing from, so the toggle below is a real, working
 * local preference rather than a connected mailing-list setting, and
 * "Clear my data" (the local equivalent of "Delete Account") lives here
 * since this is where someone looking for privacy controls would check
 * first.
 */
export default function SettingsCommunicationView({ onBack }: SettingsCommunicationViewProps) {
  const [emailUpdates, setEmailUpdates] = useState(loadEmailUpdates)
  const [confirmingClear, setConfirmingClear] = useState(false)

  function toggleEmailUpdates() {
    const next = !emailUpdates
    setEmailUpdates(next)
    try {
      localStorage.setItem(EMAIL_UPDATES_KEY, String(next))
    } catch {
      // Best-effort — localStorage may be unavailable (private mode, quota).
    }
  }

  function handleClearData() {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    clearAllLocalData()
    window.location.reload()
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Communication" onBack={onBack} />
      <div className="px-4 pt-4 pb-6">
        <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-3 mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-900 dark:text-night-100 m-0">Product updates by email</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
              Respira has no account or email on file, so this only controls whether the setting shows as
              on for you locally — nothing is actually sent.
            </p>
          </div>
          <button
            onClick={toggleEmailUpdates}
            aria-label="Toggle product updates by email"
            className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
              emailUpdates ? 'bg-[#1F4D3A] dark:bg-[#8FC7A6]' : 'bg-ink-200 dark:bg-night-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                emailUpdates ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* The local equivalent of "Delete Account" — this app has no
            server-side account, so there's nothing to delete remotely.
            What's real and honest to offer instead is wiping the data
            that actually exists: everything saved in this browser. */}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-night-400 mb-2">
          Data & privacy
        </h2>
        <p className="text-xs text-ink-600 dark:text-night-200 mb-3">
          Activities, your health profile, and alert preferences are stored only on this device — there's
          no account on a server to delete. Clearing your data here removes it completely and immediately.
        </p>
        <button
          onClick={handleClearData}
          className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
            confirmingClear
              ? 'bg-aqi-unhealthy text-white'
              : 'border border-ink-200 dark:border-night-600 text-ink-900 dark:text-night-100'
          }`}
        >
          {confirmingClear ? 'Tap again to permanently clear all data' : 'Clear my data'}
        </button>
      </div>
    </div>
  )
}
