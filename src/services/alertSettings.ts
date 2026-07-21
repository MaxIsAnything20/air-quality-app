// Threshold-based alert preferences for the Alerts tab. Stored client-side
// only. Actual notification delivery is handled by
// hooks/useAlertNotifications.ts using the browser Notification API — there's
// no push server here, so alerts only fire while the app is open in a tab
// (or, on platforms that support it, backgrounded but not fully closed).
const STORAGE_KEY = 'airtrack:alertSettings'

export interface AlertSettings {
  enabled: boolean
  /** Fire a notification when current AQI reaches or exceeds this value. */
  thresholdAqi: number
}

export const THRESHOLD_PRESETS: { label: string; aqi: number }[] = [
  { label: 'Moderate (51+)', aqi: 51 },
  { label: 'Unhealthy for sensitive groups (101+)', aqi: 101 },
  { label: 'Unhealthy (151+)', aqi: 151 },
  { label: 'Very unhealthy (201+)', aqi: 201 }
]

/** EPA's guidance kicks in earlier for sensitive groups (Moderate, 51+)
 *  than the general public (Unhealthy for Sensitive Groups, 101+) — see
 *  src/services/aqiGuidance.ts. Used both to seed a first-time default and
 *  to show a suggestion in the Alerts tab if the saved threshold doesn't
 *  match what the current profile would suggest. */
export function suggestedThresholdAqi(sensitiveProfile: boolean): number {
  return sensitiveProfile ? 51 : 101
}

function defaultSettings(sensitiveProfile = false): AlertSettings {
  return { enabled: false, thresholdAqi: suggestedThresholdAqi(sensitiveProfile) }
}

export function loadAlertSettings(sensitiveProfile = false): AlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings(sensitiveProfile)
    const parsed = JSON.parse(raw)
    if (typeof parsed?.thresholdAqi !== 'number') return defaultSettings(sensitiveProfile)
    return { enabled: Boolean(parsed.enabled), thresholdAqi: parsed.thresholdAqi }
  } catch {
    return defaultSettings(sensitiveProfile)
  }
}

export function saveAlertSettings(settings: AlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Best-effort — localStorage may be unavailable (private mode, quota).
  }
}
