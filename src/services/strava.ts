// Strava connection state for this browser, mirroring the "everything
// lives in this browser, no real account system" pattern used elsewhere
// in the app (see routePlans.ts, historyLog.ts). There's no login here --
// each browser gets a random id used to key its stored OAuth tokens
// server-side in Redis (see api/strava/callback.ts).
const DEVICE_ID_KEY = 'respira_device_id'

export function getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
          id = crypto.randomUUID()
          localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
}

export interface StravaStatus {
    connected: boolean
    athlete: { firstname: string; lastname: string; profile: string } | null
}

export async function getStravaStatus(): Promise<StravaStatus> {
    try {
          const res = await fetch(`/api/strava/status?deviceId=${encodeURIComponent(getDeviceId())}`)
          if (!res.ok) return { connected: false, athlete: null }
          return await res.json()
    } catch {
          return { connected: false, athlete: null }
    }
}

/** Kicks off the OAuth flow by navigating the whole page to Strava's consent screen. */
export function connectStrava(): void {
    window.location.href = `/api/strava/authorize?deviceId=${encodeURIComponent(getDeviceId())}`
}

export async function disconnectStrava(): Promise<void> {
    await fetch('/api/strava/disconnect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId: getDeviceId() })
    })
}
