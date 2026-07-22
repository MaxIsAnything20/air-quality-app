import { getDeviceId } from './device'

export interface GroupSummary {
  code: string
  name: string
}

export interface LeaderboardEntry {
  deviceId: string
  displayName: string
  /** null if this member has joined but hasn't submitted a score yet. */
  score: number | null
}

export interface LeaderboardResult {
  code: string
  name: string
  leaderboard: LeaderboardEntry[]
}

/**
 * Client for the real Groups/Leaderboards backend (api/groups.ts, Upstash
 * Redis). Every call is scoped to this browser's own anonymous device id
 * (services/device.ts) — there's no login, so "you" on a leaderboard is
 * just "whichever device submitted that score."
 */
async function post<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/groups?action=${action}`, {
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
  const res = await fetch(`/api/groups?${query}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed: ${res.status}`)
  }
  return data
}

export function myDeviceId(): string {
  return getDeviceId()
}

export async function createGroup(
  groupName: string,
  displayName: string,
  score: number | null
): Promise<GroupSummary> {
  return post('create', { deviceId: getDeviceId(), displayName, groupName, score })
}

export async function joinGroup(
  code: string,
  displayName: string,
  score: number | null
): Promise<GroupSummary> {
  return post('join', { deviceId: getDeviceId(), displayName, code, score })
}

export async function leaveGroup(code: string): Promise<void> {
  await post('leave', { deviceId: getDeviceId(), code })
}

export async function submitScore(code: string, score: number): Promise<void> {
  await post('submitScore', { deviceId: getDeviceId(), code, score })
}

export async function fetchLeaderboard(code: string): Promise<LeaderboardResult> {
  return get('leaderboard', { code })
}

export async function fetchMyGroups(): Promise<GroupSummary[]> {
  const data = await get<{ groups: GroupSummary[] }>('mine', { deviceId: getDeviceId() })
  return data.groups
}
