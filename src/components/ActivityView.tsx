import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { Activity, ActivityType } from '../types'
import { ACTIVITY_TYPE_GROUPS, ACTIVITY_TYPE_LABELS, aqiLevelFromValue } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'
import {
  activityAverageAqi,
  activityDistanceMeters,
  activityDurationMs,
  activityPeakAqi,
  deleteActivity,
  trimActivity,
  updateActivityType,
} from '../services/activityLog'
import { buildActivityFeedback } from '../services/activityFeedback'
import type { ActivityTracking } from '../hooks/useActivityTracking'

interface ActivityViewProps {
  tracking: ActivityTracking
  currentAqi: number | null
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  return `${km.toFixed(km < 10 ? 2 : 1)} km`
}

function AqiBadge({ aqi }: { aqi: number | null }) {
  if (aqi == null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-ink-100 dark:bg-night-700 text-ink-400 dark:text-night-400">
        No AQI data
      </span>
    )
  }
  const level = aqiLevelFromValue(aqi)
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: aqiColor[level] }}
    >
      {aqi} · {aqiLevelLabel[level]}
    </span>
  )
}

/** Route preview for a finished (or in-progress) activity. Segments are
 * colored AND weighted by AQI level — colorblind-safe by design, since
 * this is the one place a "cleaner vs dirtier" comparison happens
 * visually rather than in text. */
function RouteMap({ activity }: { activity: Activity }) {
  if (activity.points.length < 2) {
    return (
      <div className="h-40 rounded-xl bg-ink-100 dark:bg-night-700 flex items-center justify-center">
        <p className="text-xs text-ink-400 dark:text-night-400 px-4 text-center m-0">
          Not enough GPS points were recorded to draw a route.
        </p>
      </div>
    )
  }

  const positions = activity.points.map((p) => [p.lat, p.lng] as [number, number])
  const center = positions[Math.floor(positions.length / 2)]

  const segments: { positions: [number, number][]; color: string; weight: number }[] = []
  for (let i = 1; i < activity.points.length; i++) {
    const prev = activity.points[i - 1]
    const curr = activity.points[i]
    const aqi = curr.nearestAqi ?? prev.nearestAqi
    const level = aqi != null ? aqiLevelFromValue(aqi) : 'good'
    const weight = aqi != null ? 3 + Math.min(4, Math.floor(aqi / 75)) : 3
    segments.push({
      positions: [
        [prev.lat, prev.lng],
        [curr.lat, curr.lng],
      ],
      color: aqiColor[level],
      weight,
    })
  }

  return (
    <div className="h-40 rounded-xl overflow-hidden border border-ink-200 dark:border-night-600">
      <MapContainer
        center={center}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {segments.map((seg, i) => (
          <Polyline key={i} positions={seg.positions} pathOptions={{ color: seg.color, weight: seg.weight }} />
        ))}
      </MapContainer>
    </div>
  )
}

/** Keeps a live map centered on a moving position — MapContainer's
 * center/zoom props only apply on first mount, so following new GPS
 * points as they arrive needs an imperative map.setView() call instead. */
function RecenterOnLive({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true })
  }, [position, map])
  return null
}

/** Same AQI-colored-segment rendering as RouteMap, but draggable/zoomable
 * and re-centering on the newest real GPS point as the activity records —
 * this is what makes the live map actually "live" rather than a static
 * snapshot. */
function LiveRouteMap({ activity }: { activity: Activity }) {
  if (activity.points.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-ink-100 dark:bg-night-700">
        <p className="text-xs text-ink-400 dark:text-night-400 px-4 text-center m-0">
          Waiting for a GPS fix to start drawing your route.
        </p>
      </div>
    )
  }

  const last: [number, number] = [
    activity.points[activity.points.length - 1].lat,
    activity.points[activity.points.length - 1].lng,
  ]

  const segments: { positions: [number, number][]; color: string; weight: number }[] = []
  for (let i = 1; i < activity.points.length; i++) {
    const prev = activity.points[i - 1]
    const curr = activity.points[i]
    const aqi = curr.nearestAqi ?? prev.nearestAqi
    const level = aqi != null ? aqiLevelFromValue(aqi) : 'good'
    const weight = aqi != null ? 3 + Math.min(4, Math.floor(aqi / 75)) : 3
    segments.push({
      positions: [
        [prev.lat, prev.lng],
        [curr.lat, curr.lng],
      ],
      color: aqiColor[level],
      weight,
    })
  }

  return (
    <MapContainer center={last} zoom={16} className="h-full w-full" zoomControl={false}>
      <RecenterOnLive position={last} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {segments.map((seg, i) => (
        <Polyline key={i} positions={seg.positions} pathOptions={{ color: seg.color, weight: seg.weight }} />
      ))}
      <CircleMarker
        center={last}
        radius={7}
        pathOptions={{ color: '#1F4D3A', fillColor: '#1F4D3A', fillOpacity: 1, weight: 2 }}
      />
    </MapContainer>
  )
}

function TypePicker({ onStart }: { onStart: (type: ActivityType) => void }) {
  return (
    <div className="space-y-4">
      {ACTIVITY_TYPE_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-medium text-ink-400 dark:text-night-400 uppercase tracking-wide mb-2">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {group.types.map((type) => (
              <button
                key={type}
                onClick={() => onStart(type)}
                className="text-sm text-left px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100"
              >
                {ACTIVITY_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Lets you reclassify a saved activity's type and trim GPS noise off the
 * start/end of its recorded route — the editable-segment counterpart to
 * the delete-only flow that existed before. Trimming previews the
 * resulting distance/duration live (computed from the same pure
 * activityDistanceMeters/activityDurationMs functions used everywhere
 * else) before you commit anything to storage. */
function EditActivityForm({
  activity,
  onCancel,
  onSave,
}: {
  activity: Activity
  onCancel: () => void
  onSave: (updated: Activity) => void
}) {
  const [editType, setEditType] = useState<ActivityType>(activity.type)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(Math.max(0, activity.points.length - 1))

  const canTrim = activity.points.length > 2
  const previewPoints = activity.points.slice(trimStart, trimEnd + 1)
  const previewDistance = activityDistanceMeters({ ...activity, points: previewPoints })
  const previewDurationMs =
    previewPoints.length >= 2 ? previewPoints[previewPoints.length - 1].timestamp - previewPoints[0].timestamp : 0
  const trimmedCount = activity.points.length - previewPoints.length

  function handleSave() {
    let updated = activity
    if (editType !== activity.type) {
      updated = updateActivityType(activity.id, editType) ?? updated
    }
    if (canTrim && (trimStart > 0 || trimEnd < activity.points.length - 1)) {
      updated = trimActivity(activity.id, trimStart, trimEnd) ?? updated
    }
    onSave(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Edit activity</h2>
        <button onClick={onCancel} className="text-xs text-ink-400 dark:text-night-400 underline">
          Cancel
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-900 dark:text-night-100 mb-1.5">Activity type</p>
        <select
          value={editType}
          onChange={(e) => setEditType(e.target.value as ActivityType)}
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100"
        >
          {ACTIVITY_TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_TYPE_LABELS[type]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {canTrim ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-ink-900 dark:text-night-100 m-0">
            Trim route
            <span className="font-normal text-ink-400 dark:text-night-400">
              {' '}
              — crop out GPS drift at the start or end
            </span>
          </p>

          <div>
            <div className="flex items-center justify-between text-xs text-ink-600 dark:text-night-200 mb-1">
              <span>Trim start</span>
              <span>{trimStart} point{trimStart === 1 ? '' : 's'} removed</span>
            </div>
            <input
              type="range"
              min={0}
              max={activity.points.length - 2}
              value={trimStart}
              onChange={(e) => {
                const v = Number(e.target.value)
                setTrimStart(v)
                setTrimEnd((end) => Math.max(end, v + 1))
              }}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-ink-600 dark:text-night-200 mb-1">
              <span>Trim end</span>
              <span>
                {activity.points.length - 1 - trimEnd} point{activity.points.length - 1 - trimEnd === 1 ? '' : 's'}{' '}
                removed
              </span>
            </div>
            <input
              type="range"
              min={trimStart + 1}
              max={activity.points.length - 1}
              value={trimEnd}
              onChange={(e) => setTrimEnd(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">
              {trimmedCount > 0
                ? `Keeping ${previewPoints.length} of ${activity.points.length} GPS points`
                : 'Full route kept'}
            </p>
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0 mt-1">
              {formatDistance(previewDistance)} · {formatDuration(previewDurationMs)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">
          Not enough GPS points recorded to trim this route.
        </p>
      )}

      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] text-white text-sm font-medium"
      >
        Save changes
      </button>
    </div>
  )
}

function ActivitySummary({
  activity,
  onClose,
  onDelete,
  onUpdate,
}: {
  activity: Activity
  onClose: () => void
  onDelete?: () => void
  onUpdate?: (updated: Activity) => void
}) {
  const [editing, setEditing] = useState(false)
  const distance = activityDistanceMeters(activity)
  const duration = activityDurationMs(activity)
  const avgAqi = activityAverageAqi(activity)
  const peakAqi = activityPeakAqi(activity)
  const feedback = buildActivityFeedback(activity)

  if (editing && onUpdate) {
    return (
      <EditActivityForm
        activity={activity}
        onCancel={() => setEditing(false)}
        onSave={(updated) => {
          setEditing(false)
          onUpdate(updated)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">
          {ACTIVITY_TYPE_LABELS[activity.type]}
        </h2>
        <div className="flex items-center gap-3">
          {onUpdate && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-[#1F4D3A] dark:text-[#8FC7A6] underline"
            >
              Edit
            </button>
          )}
          <button onClick={onClose} className="text-xs text-ink-400 dark:text-night-400 underline">
            Close
          </button>
        </div>
      </div>

      <RouteMap activity={activity} />

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">Distance</p>
          <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{formatDistance(distance)}</p>
        </div>
        <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">Duration</p>
          <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{formatDuration(duration)}</p>
        </div>
        <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
          <p className="text-xs text-ink-600 dark:text-night-200 m-0">Avg AQI</p>
          <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{avgAqi ?? '—'}</p>
        </div>
      </div>

      {peakAqi != null && (
        <p className="text-xs text-ink-400 dark:text-night-400 m-0">Peak exposure: {peakAqi} AQI</p>
      )}

      <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-3">
        <p className="text-sm text-ink-900 dark:text-night-100 m-0">{feedback}</p>
      </div>

      {onDelete && (
        <button onClick={onDelete} className="text-xs text-aqi-unhealthy underline">
          Delete this activity
        </button>
      )}
    </div>
  )
}

function HistoryList({ history, onSelect }: { history: Activity[]; onSelect: (activity: Activity) => void }) {
  const completed = history.filter((a) => a.status === 'completed')

  if (completed.length === 0) {
    return (
      <p className="text-xs text-ink-400 dark:text-night-400 text-center py-6 m-0">
        No activities logged yet. Start one above to begin tracking your exposure.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {completed.map((activity) => {
        const avgAqi = activityAverageAqi(activity)
        const level = avgAqi != null ? aqiLevelFromValue(avgAqi) : null
        return (
          <button
            key={activity.id}
            onClick={() => onSelect(activity)}
            className="w-full text-left flex items-center justify-between bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
          >
            <div>
              <p className="text-sm text-ink-900 dark:text-night-100 m-0">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
              <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                {new Date(activity.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                {formatDistance(activityDistanceMeters(activity))} · {formatDuration(activityDurationMs(activity))}
              </p>
            </div>
            {avgAqi != null && level && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0"
                style={{ backgroundColor: aqiColor[level] }}
              >
                {avgAqi}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ActivityView({ tracking, currentAqi }: ActivityViewProps) {
  const { active, history, permissionError, resumedNotice, start, stop, discard, refreshHistory } = tracking
  const [tick, setTick] = useState(0)
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null)
  const [justFinished, setJustFinished] = useState<Activity | null>(null)
  const [fullScreenMap, setFullScreenMap] = useState(false)
  const prevActiveIdRef = useRef<string | null>(null)

  // Re-render once a second while an activity is active so the live
  // duration readout keeps ticking without needing its own timer state.
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])

  // The full-screen map only makes sense while an activity is running —
  // if the activity stops or gets discarded out from under it, drop back
  // to the normal (non-map-covering) tracking view instead of leaving a
  // stale overlay up.
  useEffect(() => {
    if (!active) setFullScreenMap(false)
  }, [active])

  // When `active` transitions to null after being non-null, the activity
  // that was running just got stopped or discarded — pull it out of the
  // refreshed history so a completed run opens straight into its summary
  // instead of dropping back to the type picker.
  useEffect(() => {
    if (active) {
      prevActiveIdRef.current = active.id
      return
    }
    if (prevActiveIdRef.current) {
      const finishedId = prevActiveIdRef.current
      prevActiveIdRef.current = null
      const finished = history.find((a) => a.id === finishedId)
      if (finished && finished.status === 'completed') {
        setJustFinished(finished)
      }
    }
  }, [active, history])

  const viewing = viewingActivity ?? justFinished

  if (viewing) {
    return (
      <div className="px-4 py-4">
        <ActivitySummary
          activity={viewing}
          onClose={() => {
            setViewingActivity(null)
            setJustFinished(null)
          }}
          onDelete={() => {
            deleteActivity(viewing.id)
            refreshHistory()
            setViewingActivity(null)
            setJustFinished(null)
          }}
          onUpdate={(updated) => {
            refreshHistory()
            if (viewingActivity) setViewingActivity(updated)
            else setJustFinished(updated)
          }}
        />
      </div>
    )
  }

  if (active) {
    const distance = activityDistanceMeters(active)
    const duration = activityDurationMs(active)
    const avgAqi = activityAverageAqi(active)
    const lastAqi = active.points[active.points.length - 1]?.nearestAqi ?? currentAqi
    void tick

    return (
      <div className="relative px-4 py-4 space-y-4">
        {resumedNotice && (
          <div className="bg-aqi-moderate/10 border border-aqi-moderate/30 rounded-xl px-3 py-2.5">
            <p className="text-xs text-ink-900 dark:text-night-100 m-0">
              Resumed an activity that was still running when this tab reloaded.
            </p>
          </div>
        )}

        <div className="text-center py-2">
          <p className="text-xs text-ink-400 dark:text-night-400 uppercase tracking-wide mb-1">
            {ACTIVITY_TYPE_LABELS[active.type]}
          </p>
          <p className="text-4xl font-mono text-ink-900 dark:text-night-100 m-0">{formatDuration(duration)}</p>
        </div>

        <div className="relative h-48 rounded-xl overflow-hidden border border-ink-200 dark:border-night-600">
          <LiveRouteMap activity={active} />
          <button
            onClick={() => setFullScreenMap(true)}
            aria-label="Expand map to full screen"
            className="absolute top-2 right-2 z-[1000] w-8 h-8 rounded-lg bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">Distance</p>
            <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{formatDistance(distance)}</p>
          </div>
          <div className="bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5">
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">Exposure so far</p>
            <p className="text-lg font-medium text-ink-900 dark:text-night-100 m-0 mt-1">{avgAqi ?? '—'}</p>
          </div>
        </div>

        <div className="flex justify-center">
          <AqiBadge aqi={lastAqi} />
        </div>

        {permissionError && <p className="text-xs text-aqi-unhealthy text-center m-0">{permissionError}</p>}

        <div className="flex gap-2">
          <button
            onClick={discard}
            className="flex-1 py-3 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
          >
            Discard
          </button>
          <button
            onClick={stop}
            className="flex-1 py-3 rounded-xl bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] text-white text-sm font-medium"
          >
            Stop
          </button>
        </div>

        {fullScreenMap && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-night-900 flex flex-col">
            <div className="flex-1 relative">
              <LiveRouteMap activity={active} />
              <button
                onClick={() => setFullScreenMap(false)}
                aria-label="Collapse map"
                className="absolute top-3 left-3 z-[1000] w-9 h-9 rounded-full bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 flex items-center justify-center text-ink-900 dark:text-night-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div className="absolute top-3 right-3 z-[1000]">
                <AqiBadge aqi={lastAqi} />
              </div>
            </div>
            <div className="border-t border-ink-200 dark:border-night-600 px-4 py-3 bg-white dark:bg-night-900">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-ink-400 dark:text-night-400 m-0">{ACTIVITY_TYPE_LABELS[active.type]}</p>
                  <p className="text-xl font-mono text-ink-900 dark:text-night-100 m-0">{formatDuration(duration)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400 dark:text-night-400 m-0">Distance</p>
                  <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">{formatDistance(distance)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={discard}
                  className="flex-1 py-2.5 rounded-xl bg-ink-100 dark:bg-night-700 text-ink-900 dark:text-night-100 text-sm font-medium"
                >
                  Discard
                </button>
                <button
                  onClick={stop}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] text-white text-sm font-medium"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <div className="text-center">
        <AqiBadge aqi={currentAqi} />
      </div>

      {permissionError && <p className="text-xs text-aqi-unhealthy text-center m-0">{permissionError}</p>}

      <div>
        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-2">Start an activity</h2>
        <TypePicker onStart={start} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-ink-900 dark:text-night-100 mb-2">History</h2>
        <HistoryList history={history} onSelect={setViewingActivity} />
      </div>
    </div>
  )
}
