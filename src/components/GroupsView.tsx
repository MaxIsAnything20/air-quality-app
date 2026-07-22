import { useEffect, useState } from 'react'
import ScreenHeader from './ScreenHeader'
import {
  createGroup,
  fetchLeaderboard,
  fetchMyGroups,
  joinGroup,
  leaveGroup,
  myDeviceId,
  submitScore,
} from '../services/groups'
import type { GroupSummary, LeaderboardResult } from '../services/groups'
import type { ExposureScoreResult } from '../services/exposureScore'

interface GroupsViewProps {
  onBack: () => void
  exposureScore: ExposureScoreResult | null
}

type Mode = 'list' | 'create' | 'join'

/**
 * Groups is a real social/comparison feature backed by Upstash Redis
 * (see api/groups.ts + services/groups.ts). Each device has an anonymous
 * persistent id (services/device.ts) that stands in for identity since
 * this app has no real user accounts. Members create or join a group with
 * a 6-character code and push their own already-computed exposure score
 * onto that group's leaderboard.
 */
export default function GroupsView({ onBack, exposureScore }: GroupsViewProps) {
  const [mode, setMode] = useState<Mode>('list')
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewingCode, setViewingCode] = useState<string | null>(null)

  async function refreshGroups() {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchMyGroups()
      setGroups(list)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your groups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshGroups()
  }, [])

  if (viewingCode) {
    return (
      <LeaderboardScreen
        code={viewingCode}
        onBack={() => {
          setViewingCode(null)
          refreshGroups()
        }}
        exposureScore={exposureScore}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Groups" onBack={onBack} />
      <div className="px-4 pt-4 pb-6 space-y-4">
        {mode === 'list' && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('create')}
                className="flex-1 py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium"
              >
                Create group
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex-1 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
              >
                Join group
              </button>
            </div>

            {loading && (
              <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">
                Loading your groups…
              </p>
            )}

            {loadError && (
              <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3">
                <p className="text-xs text-ink-900 dark:text-night-100 m-0">{loadError}</p>
              </div>
            )}

            {!loading && !loadError && groups.length === 0 && (
              <div className="flex flex-col items-center justify-center px-8 text-center gap-3 py-8">
                <span className="w-14 h-14 rounded-full bg-ink-100 dark:bg-night-700 flex items-center justify-center">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="text-ink-400 dark:text-night-400"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">No leaderboards yet</p>
                <p className="text-xs text-ink-400 dark:text-night-400 m-0">
                  Join a leaderboard to compare your score with friends, or create your own to challenge a
                  group.
                </p>
              </div>
            )}

            {!loading && groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((g) => (
                  <button
                    key={g.code}
                    onClick={() => setViewingCode(g.code)}
                    className="w-full text-left flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm text-ink-900 dark:text-night-100 m-0">{g.name}</p>
                      <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5 font-mono">
                        {g.code}
                      </p>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-ink-400 dark:text-night-400"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'create' && (
          <CreateGroupForm
            exposureScore={exposureScore}
            onCancel={() => setMode('list')}
            onCreated={(code) => {
              setMode('list')
              setViewingCode(code)
            }}
          />
        )}

        {mode === 'join' && (
          <JoinGroupForm
            exposureScore={exposureScore}
            onCancel={() => setMode('list')}
            onJoined={(code) => {
              setMode('list')
              setViewingCode(code)
            }}
          />
        )}
      </div>
    </div>
  )
}

function CreateGroupForm({
  onCreated,
  onCancel,
  exposureScore,
}: {
  onCreated: (code: string) => void
  onCancel: () => void
  exposureScore: ExposureScoreResult | null
}) {
  const [groupName, setGroupName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!groupName.trim() || !displayName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const group = await createGroup(groupName.trim(), displayName.trim(), exposureScore?.score ?? null)
      onCreated(group.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this group.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Group name</p>
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g. Family, Running club"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">
          Your name on the leaderboard
        </p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Max"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      {error && <p className="text-xs text-aqi-unhealthy m-0">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={busy || !groupName.trim() || !displayName.trim()}
          className="flex-1 py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </div>
  )
}

function JoinGroupForm({
  onJoined,
  onCancel,
  exposureScore,
}: {
  onJoined: (code: string) => void
  onCancel: () => void
  exposureScore: ExposureScoreResult | null
}) {
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    if (!code.trim() || !displayName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const group = await joinGroup(code.trim(), displayName.trim(), exposureScore?.score ?? null)
      onJoined(group.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that group.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Join code</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7K2QXM"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none uppercase tracking-widest"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">
          Your name on the leaderboard
        </p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Max"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      {error && <p className="text-xs text-aqi-unhealthy m-0">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleJoin}
          disabled={busy || !code.trim() || !displayName.trim()}
          className="flex-1 py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Joining…' : 'Join group'}
        </button>
      </div>
    </div>
  )
}

function LeaderboardScreen({
  code,
  onBack,
  exposureScore,
}: {
  code: string
  onBack: () => void
  exposureScore: ExposureScoreResult | null
}) {
  const [result, setResult] = useState<LeaderboardResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const deviceId = myDeviceId()

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchLeaderboard(code)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this leaderboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function handleSyncMyScore() {
    if (exposureScore == null) return
    try {
      await submitScore(code, exposureScore.score)
      await refresh()
    } catch {
      // Silent — refresh() failing separately already surfaces its own error,
      // and the leaderboard simply won't reflect the new score yet.
    }
  }

  async function handleLeave() {
    setLeaving(true)
    try {
      await leaveGroup(code)
      onBack()
    } catch {
      setLeaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title={result?.name ?? 'Leaderboard'} onBack={onBack} />
      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs text-ink-400 dark:text-night-400 m-0">Join code</p>
            <p className="text-sm font-mono font-semibold text-ink-900 dark:text-night-100 m-0">{code}</p>
          </div>
          <button onClick={refresh} className="text-xs text-[#1F4D3A] dark:text-[#8FC7A6] underline">
            Refresh
          </button>
        </div>

        {exposureScore != null && (
          <button
            onClick={handleSyncMyScore}
            className="w-full py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium"
          >
            Sync my score ({exposureScore.score})
          </button>
        )}

        {loading && (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-4 m-0">
            Loading leaderboard…
          </p>
        )}

        {error && (
          <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3">
            <p className="text-xs text-ink-900 dark:text-night-100 m-0">{error}</p>
          </div>
        )}

        {!loading && result && (
          <div className="space-y-2">
            {result.leaderboard.length === 0 ? (
              <p className="text-xs text-ink-400 dark:text-night-400 text-center py-4 m-0">
                No scores submitted yet.
              </p>
            ) : (
              result.leaderboard.map((entry, index) => {
                const isMe = entry.deviceId === deviceId
                return (
                  <div
                    key={entry.deviceId}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                      isMe
                        ? 'bg-[#1F4D3A]/10 dark:bg-[#8FC7A6]/10 border border-[#1F4D3A]/30 dark:border-[#8FC7A6]/30'
                        : 'bg-ink-100 dark:bg-night-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-ink-400 dark:text-night-400 w-4 text-right">
                        {entry.score != null ? index + 1 : '—'}
                      </span>
                      <p className="text-sm text-ink-900 dark:text-night-100 m-0">
                        {entry.displayName}
                        {isMe && <span className="text-ink-400 dark:text-night-400"> (you)</span>}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink-900 dark:text-night-100">
                      {entry.score ?? '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}

        <button
          onClick={handleLeave}
          disabled={leaving}
          className="text-xs text-aqi-unhealthy underline disabled:opacity-50"
        >
          {leaving ? 'Leaving…' : 'Leave this group'}
        </button>
      </div>
    </div>
  )
}
