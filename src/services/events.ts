import { getDeviceId } from './device'

export interface EventSummary {
  code: string
  name: string
  startsAt: number | null
  location: string | null
}

export interface EventMember {
  deviceId: string
  displayName: string
  /** null until this member taps "Check in" at the event. */
  checkedInAt: number | null
}

export interface EventDetails extends EventSummary {
  members: EventMember[]
}

export interface MyEvent extends EventSummary {
  checkedInAt: number | null
}

/**
 * Client for the real Events backend (api/events.ts, Upstash Redis) —
 * create/join/check-in, same anonymous per-device identity model as
 * services/groups.ts. Deliberately not a public events-discovery feed
 * (that would need a paid third-party API); these are private, code-based
 * events you create and share with people you already know.
 */
async function post<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/events?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed: ${res.status}`)
  }
  return data
}

async function get<T>(action: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ action, ...params })
  const res = await fetch(`/api/events?${query}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed: ${res.status}`)
  }
  return data
}

export function myDeviceId(): string {
  return getDeviceId()
}

export async function createEvent(
  eventName: string,
  displayName: string,
  startsAt: number,
  location: string | null
): Promise<EventSummary> {
  return post('create', { deviceId: getDeviceId(), displayName, eventName, startsAt, location })
}

export async function joinEvent(code: string, displayName: string): Promise<EventSummary> {
  return post('join', { deviceId: getDeviceId(), displayName, code })
}

export async function leaveEvent(code: string): Promise<void> {
  await post('leave', { deviceId: getDeviceId(), code })
}

export async function checkInToEvent(code: string, displayName?: string): Promise<{ checkedInAt: number }> {
  return post('checkIn', { deviceId: getDeviceId(), code, displayName })
}

export async function fetchEventDetails(code: string): Promise<EventDetails> {
  return get('details', { code })
}

export async function fetchMyEvents(): Promise<MyEvent[]> {
  const data = await get<{ events: MyEvent[] }>('mine', { deviceId: getDeviceId() })
  return data.events
}
