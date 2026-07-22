import { useMemo } from 'react'
import { aqiToScore, scoreLabel } from '../types'
import type { ExposureScoreResult } from '../services/exposureScore'
import { buildEstimatedHourlySeries, findCleanestWindow, formatCleanestWindowLabel } from '../services/forecastCurve'
import type { ScreenId } from './HamburgerMenu'

interface HomeViewProps {
  currentAqi: number | null
  forecastPeakAqi: number | null
  locationLabel: string
  exposureScore: ExposureScoreResult | null
  streak: number
  badgeEarned: boolean
  onNavigate: (screen: ScreenId) => void
  onOpenMenu: () => void
}

const SCORE_COLOR: Record<string, string> = {
  Excellent: '#3B9E5F',
  Good: '#7FAE4E',
  Fair: '#C99A2E',
  Poor: '#D2762E',
  'Very poor': '#C24545'
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function ScoreRing({ score, size = 60 }: { score: number | null; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = ((score ?? 0) / 100) * circumference
  const color = score != null ? SCORE_COLOR[scoreLabel(score)] : undefined

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-ink-200 dark:stroke-night-600"
      />
      {score != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {score != null ? (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: size * 0.3, fontWeight: 600 }}
          className="fill-ink-900 dark:fill-night-100"
        >
          {score}
        </text>
      ) : (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: size * 0.15 }}
          className="fill-ink-400 dark:fill-night-400"
        >
          No data
        </text>
      )}
    </svg>
  )
}

function DiamondIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D9922B" strokeWidth="2">
      <path d="M6 3h12l4 6-10 12L2 9Z" />
    </svg>
  )
}

export default function HomeView({
  currentAqi,
  forecastPeakAqi,
  locationLabel,
  exposureScore,
  streak,
  badgeEarned,
  onNavigate,
  onOpenMenu
}: HomeViewProps) {
  const outdoorScore = currentAqi != null ? aqiToScore(currentAqi) : null
  const outdoorLabel = outdoorScore != null ? scoreLabel(outdoorScore) : null

  // The same estimated hourly curve shown on the forecast screen (see
  // services/forecastCurve.ts) — anchored on the real current reading and
  // today's real forecast peak — collapsed down to the single longest
  // "Good or better" stretch of the day, e.g. "6 AM–7 PM", rather than
  // the old three-way Now/Later/Steady guess. Purely a display label
  // here (no navigation): see the chip below.
  const cleanestTimeLabel = useMemo(() => {
    if (currentAqi == null || forecastPeakAqi == null) return 'Not available'
    const nowHour = new Date().getHours()
    const series = buildEstimatedHourlySeries(currentAqi, forecastPeakAqi, nowHour)
    return formatCleanestWindowLabel(findCleanestWindow(series))
  }, [currentAqi, forecastPeakAqi])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-gradient-to-b from-[#1F4D3A] to-[#2F6B4F] dark:from-[#0D2A1E] dark:to-[#123A29] px-4 pt-4 pb-7 rounded-b-3xl">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-white/85 m-0">{getGreeting()}</p>
          <button onClick={onOpenMenu} aria-label="Open menu" className="w-8 h-8 flex items-center justify-center -mr-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-wide text-white/70 m-0 mb-1">AIR QUALITY RIGHT NOW</p>
            {outdoorScore != null ? (
              <p className="text-5xl font-semibold text-white m-0 leading-none">
                {outdoorScore}
                <span className="text-2xl align-top">%</span>
              </p>
            ) : (
              <p className="text-3xl font-semibold text-white/70 m-0">—</p>
            )}
            {outdoorLabel && <p className="text-sm text-white/85 m-0 mt-1.5">{outdoorLabel}</p>}
          </div>

          <div className="bg-white/15 rounded-xl px-3 py-2 text-right shrink-0">
            <p className="text-[10px] text-white/70 m-0">CLEANEST TIME</p>
            <p className="text-sm font-medium text-white m-0">{cleanestTimeLabel}</p>
          </div>
        </div>

        <p className="flex items-center gap-1 text-xs text-white/75 mt-3 mb-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {locationLabel}
        </p>
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-xs font-medium tracking-wide text-ink-400 dark:text-night-400 mb-2">NOW</h2>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={() => onNavigate('forecast')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">Outdoor air</p>
            {outdoorScore != null ? (
              <>
                <p className="text-xl font-medium text-ink-900 dark:text-night-100 m-0 mt-1">
                  {outdoorScore}% <span className="text-xs font-normal" style={{ color: outdoorLabel ? SCORE_COLOR[outdoorLabel] : undefined }}>{outdoorLabel}</span>
                </p>
                <div className="h-1.5 rounded-full bg-ink-200 dark:bg-night-600 overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${outdoorScore}%`, backgroundColor: outdoorLabel ? SCORE_COLOR[outdoorLabel] : undefined }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-400 dark:text-night-400 m-0 mt-1">No live data</p>
            )}
          </button>

          <button
            onClick={() => onNavigate('indoorAir')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">Indoor air</p>
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0 mt-1">Set up now</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">Connect an indoor sensor</p>
          </button>

          <button
            onClick={() => onNavigate('routePlanning')}
            className="col-span-2 bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <p className="text-xs text-ink-600 dark:text-night-200 m-0">Routes</p>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F4D3A" strokeWidth="1.8" className="dark:stroke-[#8FC7A6] mt-1">
              <path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3ZM9 3v15M15 5.5v15" />
            </svg>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-1">Find a cleaner route</p>
          </button>
        </div>

        <h2 className="text-xs font-medium tracking-wide text-ink-400 dark:text-night-400 mb-2">YOU</h2>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={() => onNavigate('activity')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-center flex flex-col items-center"
          >
            <span className="w-10 h-10 rounded-full border-2 border-[#1F4D3A] dark:border-[#8FC7A6] flex items-center justify-center mb-1.5">
              <span className="w-4 h-4 rounded-full bg-[#1F4D3A] dark:bg-[#8FC7A6]" />
            </span>
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Record</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">Track your exposure now</p>
          </button>

          <button
            onClick={() => onNavigate('groups')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Groups</p>
            <p className="text-sm text-ink-900 dark:text-night-100 m-0 mt-1">Join a leaderboard</p>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
              Compare your exposure with others
            </p>
          </button>
        </div>

        <button
          onClick={() => onNavigate('myActivities')}
          className="w-full bg-ink-100 dark:bg-night-700 rounded-2xl p-4 text-left flex items-center gap-4 mb-2.5"
        >
          <ScoreRing score={exposureScore?.score ?? null} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">My activities</p>
            {exposureScore ? (
              <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                {exposureScore.label} · based on {exposureScore.daysConsidered} logged day
                {exposureScore.daysConsidered === 1 ? '' : 's'}
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-900 dark:text-night-100 m-0 mt-0.5">No activities yet</p>
                <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
                  Start moving to build your score
                </p>
              </>
            )}
          </div>
        </button>

        <button
          onClick={() => onNavigate('settingsProfile')}
          className="w-full text-left bg-ink-100 dark:bg-night-700 rounded-2xl p-4 mb-5"
        >
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Badges</p>
          <p className="text-sm text-ink-900 dark:text-night-100 m-0 mt-1">
            {badgeEarned ? '1 badge earned' : 'Start earning'}
          </p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
            {badgeEarned ? 'First activity — unlocked' : '1 badge to unlock'}
          </p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-1">
            {streak > 0 ? `🔥 ${streak}-day streak` : 'Check in and hit milestones to earn'}
          </p>
        </button>

        <h2 className="text-xs font-medium tracking-wide text-ink-400 dark:text-night-400 mb-2">SETUP</h2>
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          {/* AutoTrack ("passive 24/7 tracking") is a genuinely different
              feature from the foreground Record flow — a browser tab can't
              track location while closed the way a native app can, so this
              stays a premium teaser rather than a toggle that would quietly
              not do what it claims. See README "Roadmap". */}
          <button
            onClick={() => onNavigate('paywall')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">AutoTrack</p>
              <DiamondIcon />
            </div>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-[11px] bg-ink-200 dark:bg-night-600 text-ink-600 dark:text-night-200">
              Off
            </span>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-2">
              Turn on AutoTrack to gather your exposure data 24/7
            </p>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="bg-ink-100 dark:bg-night-700 rounded-2xl p-3.5 text-left"
          >
            <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Connections</p>
            <div className="flex gap-1 mt-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-200 dark:bg-night-600 text-ink-600 dark:text-night-200">
                Strava
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-200 dark:bg-night-600 text-ink-600 dark:text-night-200">
                Health
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-200 dark:bg-night-600 text-ink-600 dark:text-night-200">
                Garmin
              </span>
            </div>
            <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-2">
              Connect Strava, Health & Garmin
            </p>
          </button>
        </div>

        <button
          onClick={() => onNavigate('events')}
          className="w-full bg-ink-100 dark:bg-night-700 rounded-2xl p-4 text-left mb-4"
        >
          <p className="text-sm font-medium text-ink-900 dark:text-night-100 m-0">Events</p>
          <p className="text-sm text-ink-900 dark:text-night-100 m-0 mt-1">No upcoming events</p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5">
            Air quality for events you attend
          </p>
        </button>
      </div>
    </div>
  )
}
