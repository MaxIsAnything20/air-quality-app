const KEYS_TO_CLEAR = [
  'airtrack:dailyHistory', // historyLog.ts
  'airtrack:healthProfile', // profile.ts
  'airtrack:alertSettings', // alertSettings.ts
  'respira.activities.v1', // activityLog.ts
  'respira.emailUpdates.v1', // SettingsCommunicationView.tsx
]

export function clearAllLocalData(): void {
  for (const key of KEYS_TO_CLEAR) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Best-effort — localStorage may be unavailable (private mode, quota).
    }
  }
}
