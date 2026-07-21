import { useEffect, useState } from 'react'
import { AlertSettings, THRESHOLD_PRESETS, suggestedThresholdAqi } from '../services/alertSettings'
import {
  disableBackgroundAlerts,
  enableBackgroundAlerts,
  getBackgroundAlertStatus,
  isPushSupported
} from '../services/pushSubscription'

interface AlertsViewProps {
  settings: AlertSettings
  onChange: (settings: AlertSettings) => void
  /** Whether the saved health profile currently puts this person in an
   *  EPA sensitive group — drives the suggested-threshold banner below. */
  sensitiveProfile: boolean
  /** Current map center — background alerts need a lat/lng to check
   *  against server-side, since api/push/check.ts runs with nobody's tab
   *  open and can't read browser geolocation itself. */
  center: [number, number]
}

type BackgroundStatus = 'checking' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'error'

export default function AlertsView({ settings, onChange, sensitiveProfile, center }: AlertsViewProps) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>('checking')
  const [backgroundBusy, setBackgroundBusy] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) {
      setBackgroundStatus('unsupported')
      return
    }
    getBackgroundAlertStatus()
      .then((status) => setBackgroundStatus(status))
      .catch(() => setBackgroundStatus('error'))
  }, [])

  // If background alerts are already on and the threshold changes,
  // re-register so the server-side check uses the new value instead of
  // silently keeping the old one until the next manual toggle.
  useEffect(() => {
    if (backgroundStatus !== 'subscribed') return
    enableBackgroundAlerts({ lat: center[0], lng: center[1], thresholdAqi: settings.thresholdAqi }).catch(() => {
      // Best-effort — if this fails, the previous threshold just stays
      // active server-side until the next successful toggle.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.thresholdAqi])

  const suggested = suggestedThresholdAqi(sensitiveProfile)
  // Only worth surfacing when following the suggestion would make alerts
  // MORE sensitive (catch things earlier) — a profile that stops being
  // sensitive isn't a safety issue worth nagging about, so this only
  // shows for the tightening direction.
  const showSuggestion = sensitiveProfile && settings.thresholdAqi !== suggested

  async function handleEnable() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    let result = Notification.permission
    if (result === 'default') {
      result = await Notification.requestPermission()
      setPermission(result)
    }
    onChange({ ...settings, enabled: result === 'granted' })
  }

  async function handleToggleBackground() {
    setBackgroundBusy(true)
    try {
      if (backgroundStatus === 'subscribed') {
        await disableBackgroundAlerts()
        setBackgroundStatus('unsubscribed')
      } else {
        await enableBackgroundAlerts({ lat: center[0], lng: center[1], thresholdAqi: settings.thresholdAqi })
        setBackgroundStatus('subscribed')
      }
    } catch (err) {
      console.warn('Background alert toggle failed:', err)
      setBackgroundStatus('error')
    } finally {
      setBackgroundBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-1">Alerts</h2>
      <p className="text-xs text-ink-600 dark:text-night-200 mb-4">
        Get notified in this browser when air quality near you crosses a threshold you pick.{' '}
        <a
          href="https://www.enviroflash.info/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          AirNow's own EnviroFlash email/text alerts
        </a>{' '}
        are a real alternative if you'd rather not rely on this browser at all.
      </p>

      <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-3 mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-900 dark:text-night-100 m-0">Enable alerts (app open)</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
            {permission === 'unsupported' && 'Notifications aren’t supported in this browser.'}
            {permission === 'denied' && 'Notifications are blocked — allow them in your browser settings.'}
            {permission === 'default' && 'You’ll be asked to allow notifications.'}
            {permission === 'granted' && (settings.enabled ? 'On' : 'Off')}
          </p>
        </div>
        <button
          onClick={() => (settings.enabled ? onChange({ ...settings, enabled: false }) : handleEnable())}
          disabled={permission === 'unsupported' || permission === 'denied'}
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${
            settings.enabled ? 'bg-aqi-good' : 'bg-ink-300 dark:bg-night-500'
          }`}
          aria-label="Toggle alerts"
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-3 mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-900 dark:text-night-100 m-0">Background alerts (app closed)</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
            {backgroundStatus === 'checking' && 'Checking...'}
            {backgroundStatus === 'unsupported' && 'Not supported in this browser, or not configured on the server.'}
            {backgroundStatus === 'error' && 'Something went wrong — try again.'}
            {backgroundStatus === 'subscribed' && 'On — checked roughly every 15 minutes, even with the app closed.'}
            {backgroundStatus === 'unsubscribed' && 'Off'}
          </p>
        </div>
        <button
          onClick={handleToggleBackground}
          disabled={backgroundStatus === 'unsupported' || backgroundStatus === 'checking' || backgroundBusy}
          className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${
            backgroundStatus === 'subscribed' ? 'bg-aqi-good' : 'bg-ink-300 dark:bg-night-500'
          }`}
          aria-label="Toggle background alerts"
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              backgroundStatus === 'subscribed' ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {showSuggestion && (
        <div className="flex items-center justify-between gap-3 bg-aqi-moderate/10 border border-aqi-moderate/30 rounded-xl px-3.5 py-2.5 mb-4">
          <p className="text-[11px] text-ink-600 dark:text-night-200 m-0">
            Your profile has a sensitive-group condition — EPA's guidance for sensitive groups starts
            earlier, at Moderate (51+), rather than Unhealthy for Sensitive Groups (101+).
          </p>
          <button
            onClick={() => onChange({ ...settings, thresholdAqi: suggested })}
            className="shrink-0 text-[11px] font-medium text-ink-900 dark:text-night-100 underline"
          >
            Use 51+
          </button>
        </div>
      )}

      <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-2">Notify me when AQI reaches</p>
      <div className="flex flex-col gap-2">
        {THRESHOLD_PRESETS.map((preset) => (
          <button
            key={preset.aqi}
            onClick={() => onChange({ ...settings, thresholdAqi: preset.aqi })}
            className={`text-left text-xs px-3 py-2.5 rounded-xl border transition-colors ${
              settings.thresholdAqi === preset.aqi
                ? 'border-ink-900 dark:border-night-100 text-ink-900 dark:text-night-100 bg-ink-100 dark:bg-night-700'
                : 'border-ink-200 dark:border-night-600 text-ink-600 dark:text-night-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
