// AirTrack's real Settings screen has a "Delete Account" action at the
// bottom that wipes your account and data server-side. This app has no
// server-side account system — everything (activities, health profile,
// alert preferences, logged daily readings) lives only in this browser's
// localStorage — so the honest local equivalent isn't "delete account,"
// it's "clear everything this app has stored on this device." That's
// what this does.
const KEYS_TO_CLEAR = [
  'airtrack:dailyHistory', // historyLog.ts
  'airtrack:healthProfile', // profile.ts
  'airtrack:alertSettings', // alertSettings.ts
  'respira.activities.v1', // activityLog.ts
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
