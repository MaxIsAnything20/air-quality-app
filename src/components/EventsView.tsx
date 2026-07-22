import { useEffect, useMemo, useState } from 'react'
import ScreenHeader from './ScreenHeader'
import {
  checkInToEvent,
  createEvent,
  fetchEventDetails,
  fetchMyEvents,
  joinEvent,
  leaveEvent,
  myDeviceId,
} from '../services/events'
import type { EventDetails, MyEvent } from '../services/events'

interface EventsViewProps {
  onBack: () => void
}

type EventsTab = 'upcoming' | 'past'
type Mode = 'list' | 'create' | 'join'

function formatEventDate(startsAt: number | null): string {
  if (startsAt == null) return 'No date set'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startsAt))
}

/**
 * Events is a real create/join/check-in feature backed by Upstash Redis
 * (see api/events.ts + services/events.ts) — deliberately NOT a public
 * events-discovery feed, which would need a paid third-party events API.
 * These are private, code-based events you create and share with people
 * you already know, same anonymous per-device identity model as Groups.
 */
export default function EventsView({ onBack }: EventsViewProps) {
  const [tab, setTab] = useState<EventsTab>('upcoming')
  const [mode, setMode] = useState<Mode>('list')
  const [events, setEvents] = useState<MyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewingCode, setViewingCode] = useState<string | null>(null)

  async function refreshEvents() {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchMyEvents()
      setEvents(list)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshEvents()
  }, [])

  const now = Date.now()
  const filtered = useMemo(() => {
    return events
      .filter((e) => (tab === 'upcoming' ? (e.startsAt ?? 0) >= now : (e.startsAt ?? 0) < now))
      .sort((a, b) =>
        tab === 'upcoming' ? (a.startsAt ?? 0) - (b.startsAt ?? 0) : (b.startsAt ?? 0) - (a.startsAt ?? 0)
      )
  }, [events, tab, now])

  if (viewingCode) {
    return (
      <EventDetailScreen
        code={viewingCode}
        onBack={() => {
          setViewingCode(null)
          refreshEvents()
        }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title="Events" onBack={onBack} />

      {mode === 'list' && (
        <div className="px-4 pt-4">
          <div className="flex bg-ink-100 dark:bg-night-700 rounded-full p-1">
            {(['upcoming', 'past'] as EventsTab[]).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 text-sm font-medium py-1.5 rounded-full capitalize transition-colors ${
                  tab === id ? 'bg-[#1F4D3A] dark:bg-[#0D2A1E] text-white' : 'text-ink-600 dark:text-night-200'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-6 space-y-4">
        {mode === 'list' && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('create')}
                className="flex-1 py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium"
              >
                Create event
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex-1 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
              >
                Join event
              </button>
            </div>

            {loading && (
              <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">
                Loading your events…
              </p>
            )}

            {loadError && (
              <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3">
                <p className="text-xs text-ink-900 dark:text-night-100 m-0">{loadError}</p>
              </div>
            )}

            {!loading && !loadError && filtered.length === 0 && (
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
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">
                  No {tab === 'upcoming' ? 'upcoming' : 'past'} events
                </p>
                <p className="text-xs text-ink-400 dark:text-night-400 m-0">
                  Create an event to share a join code, or join one with a code someone gave you.
                </p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map((event) => (
                  <button
                    key={event.code}
                    onClick={() => setViewingCode(event.code)}
                    className="w-full text-left flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm text-ink-900 dark:text-night-100 m-0">{event.name}</p>
                      <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                        {formatEventDate(event.startsAt)}
                        {event.checkedInAt != null ? ' · Checked in' : ''}
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
          <CreateEventForm
            onCancel={() => setMode('list')}
            onCreated={(code) => {
              setMode('list')
              setViewingCode(code)
            }}
          />
        )}

        {mode === 'join' && (
          <JoinEventForm
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

function CreateEventForm({
  onCreated,
  onCancel,
}: {
  onCreated: (code: string) => void
  onCancel: () => void
}) {
  const [eventName, setEventName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!eventName.trim() || !displayName.trim() || !startsAt) return
    setBusy(true)
    setError(null)
    try {
      const timestamp = new Date(startsAt).getTime()
      const event = await createEvent(eventName.trim(), displayName.trim(), timestamp, location.trim() || null)
      onCreated(event.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this event.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Event name</p>
        <input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g. Saturday trail run"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Date and time</p>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Location (optional)</p>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Riverside Park"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Your name</p>
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
          disabled={busy || !eventName.trim() || !displayName.trim() || !startsAt}
          className="flex-1 py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </div>
    </div>
  )
}

function JoinEventForm({
  onJoined,
  onCancel,
}: {
  onJoined: (code: string) => void
  onCancel: () => void
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
      const event = await joinEvent(code.trim(), displayName.trim())
      onJoined(event.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that event.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Event code</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7K2QXM"
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 outline-none uppercase tracking-widest"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Your name</p>
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
          {busy ? 'Joining…' : 'Join event'}
        </button>
      </div>
    </div>
  )
}

function EventDetailScreen({
  code,
  onBack,
}: {
  code: string
  onBack: () => void
}) {
  const [details, setDetails] = useState<EventDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const deviceId = myDeviceId()

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEventDetails(code)
      setDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this event.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const me = details?.members.find((m) => m.deviceId === deviceId)
  const alreadyCheckedIn = me?.checkedInAt != null

  async function handleCheckIn() {
    setCheckingIn(true)
    try {
      await checkInToEvent(code)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleLeave() {
    setLeaving(true)
    try {
      await leaveEvent(code)
      onBack()
    } catch {
      setLeaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <ScreenHeader title={details?.name ?? 'Event'} onBack={onBack} />
      <div className="px-4 pt-4 pb-6 space-y-4">
        {loading && (
          <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">Loading event…</p>
        )}

        {error && (
          <div className="bg-aqi-unhealthy/10 border border-aqi-unhealthy/30 rounded-xl px-3.5 py-3">
            <p className="text-xs text-ink-900 dark:text-night-100 m-0">{error}</p>
          </div>
        )}

        {!loading && details && (
          <>
            <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3.5 py-3 space-y-1">
              <p className="text-sm font-semibold text-ink-900 dark:text-night-100 m-0">{details.name}</p>
              <p className="text-xs text-ink-600 dark:text-night-200 m-0">{formatEventDate(details.startsAt)}</p>
              {details.location && (
                <p className="text-xs text-ink-600 dark:text-night-200 m-0">{details.location}</p>
              )}
              <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 pt-1 font-mono">Code: {code}</p>
            </div>

            <button
              onClick={handleCheckIn}
              disabled={checkingIn || alreadyCheckedIn}
              className="w-full py-2.5 rounded-xl bg-[#1F4D3A] dark:bg-[#8FC7A6] text-white dark:text-night-900 text-sm font-medium disabled:opacity-50"
            >
              {alreadyCheckedIn ? 'Checked in' : checkingIn ? 'Checking in…' : 'Check in'}
            </button>

            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0">
                Attendees ({details.members.length})
              </p>
              {details.members.map((member) => {
                const isMe = member.deviceId === deviceId
                return (
                  <div
                    key={member.deviceId}
                    className="flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
                  >
                    <p className="text-sm text-ink-900 dark:text-night-100 m-0">
                      {member.displayName}
                      {isMe && <span className="text-ink-400 dark:text-night-400"> (you)</span>}
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        member.checkedInAt != null
                          ? 'text-[#1F4D3A] dark:text-[#8FC7A6]'
                          : 'text-ink-400 dark:text-night-400'
                      }`}
                    >
                      {member.checkedInAt != null ? 'Checked in' : 'Not yet'}
                    </span>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleLeave}
              disabled={leaving}
              className="text-xs text-aqi-unhealthy underline disabled:opacity-50"
            >
              {leaving ? 'Leaving…' : 'Leave this event'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
