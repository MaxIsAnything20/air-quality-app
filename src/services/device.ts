const DEVICE_ID_KEY = 'respira.deviceId.v1'

/**
 * Anonymous, random per-device identifier — persisted to localStorage,
 * never sent anywhere except this app's own group/leaderboard backend
 * (see services/groups.ts, api/groups.ts). This is the closest thing to
 * an "account" this accounts-free app has: enough to let the same
 * browser rejoin a group and update its own score later, not enough to
 * identify a real person or work across devices.
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // Storage unavailable (private browsing, etc.) — fall back to a
    // session-only id rather than throwing.
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
}
