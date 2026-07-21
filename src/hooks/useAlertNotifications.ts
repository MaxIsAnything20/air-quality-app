import { useEffect } from 'react'
import { AlertSettings } from '../services/alertSettings'

const LAST_NOTIFIED_KEY = 'airtrack:lastAlertNotifiedDate'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Fires a single browser notification per calendar day when `currentAqi`
 * is at or above the saved threshold. No push server involved — this only
 * works while the app is open (foreground or backgrounded, depending on
 * the platform), same limitation any browser Notification API has.
 * `currentAqi` should be `null` while on sample data, so a fake/demo
 * reading never triggers a real notification.
 */
export function useAlertNotifications(currentAqi: number | null, settings: AlertSettings): void {
  useEffect(() => {
    if (!settings.enabled) return
    if (currentAqi == null) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (currentAqi < settings.thresholdAqi) return

    const today = todayKey()
    let lastNotified: string | null = null
    try {
      lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY)
    } catch {
      // localStorage unavailable — skip the dedupe, worst case is one
      // repeat notification, which is better than crashing.
    }
    if (lastNotified === today) return

    new Notification('Air quality alert', {
      body: `Current AQI is ${currentAqi}, at or above your ${settings.thresholdAqi} threshold.`
    })

    try {
      localStorage.setItem(LAST_NOTIFIED_KEY, today)
    } catch {
      // Best-effort.
    }
  }, [currentAqi, settings.enabled, settings.thresholdAqi])
}
