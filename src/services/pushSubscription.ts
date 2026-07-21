// Client-side glue for real background push notifications — distinct from
// hooks/useAlertNotifications.ts, which only fires while a tab is open.
// This registers public/sw.js, subscribes via the browser's native
// PushManager using the app's VAPID public key, and hands the resulting
// subscription to /api/push/subscribe so the server can send to it later
// via api/push/check.ts.
//
// VITE_VAPID_PUBLIC_KEY is the one deliberately VITE_-prefixed secret-ish
// value in this app: unlike AIRNOW_API_KEY/PURPLEAIR_API_KEY/
// ANTHROPIC_API_KEY, a VAPID *public* key is meant to be public — the
// whole point of the public/private split is that only the private half
// (VAPID_PRIVATE_KEY, server-only, used in api/push/check.ts) needs to
// stay secret.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

// PushManager wants the VAPID key as a raw Uint8Array, not the base64url
// string it's normally shared/stored as — this is the standard conversion.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export interface PushSubscribeInput {
  lat: number
  lng: number
  thresholdAqi: number
}

/** Registers the service worker (idempotent), requests a push
 *  subscription (prompts for notification permission if not already
 *  granted/denied), and registers it with the server. Throws on any
 *  failure — callers should catch and show that background alerts
 *  couldn't be enabled rather than silently doing nothing. */
export async function enableBackgroundAlerts(input: PushSubscribeInput): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser, or VITE_VAPID_PUBLIC_KEY is not set.')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string)
    })
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      lat: input.lat,
      lng: input.lng,
      thresholdAqi: input.thresholdAqi
    })
  })

  if (!res.ok) {
    throw new Error(`Failed to register push subscription: ${res.status}`)
  }
}

/** Unsubscribes both locally and on the server. Best-effort on the server
 *  half — if that call fails, the local unsubscribe still happens so the
 *  browser stops holding a subscription the person asked to cancel. */
export async function disableBackgroundAlerts(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    })
  } catch {
    // Best-effort — still unsubscribe locally below even if this fails.
  }

  await subscription.unsubscribe()
}

export async function getBackgroundAlertStatus(): Promise<'subscribed' | 'unsubscribed'> {
  if (!('serviceWorker' in navigator)) return 'unsubscribed'
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'subscribed' : 'unsubscribed'
}
