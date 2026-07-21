import { AqiLevel } from '../types'
import { aqiColor, aqiLevelLabel } from '../aqiColors'

// Semicircle dial, 0-400 on the EPA scale (covers Good through Hazardous;
// anything past 400 just pins the needle at the right end rather than
// growing the arc, since >400 is vanishingly rare and not worth the extra
// visual scale compression it would cost every other reading).
const SEGMENTS: { level: AqiLevel; from: number; to: number }[] = [
  { level: 'good', from: 0, to: 50 },
  { level: 'moderate', from: 50, to: 100 },
  { level: 'sensitive', from: 100, to: 150 },
  { level: 'unhealthy', from: 150, to: 200 },
  { level: 'veryunhealthy', from: 200, to: 300 },
  { level: 'hazardous', from: 300, to: 400 }
]

const SCALE_MAX = 400
const CX = 120
const CY = 116
const R = 96

// value=0 sits at the left end of the dial (180deg) and value=SCALE_MAX at
// the right end (0deg), sweeping over the top — angle decreases as value
// increases. Note the minus sign on y: SVG's y-axis points down, so
// tracing the *top* semicircle (not the bottom) requires cy - r*sin(angle).
function polar(value: number) {
  const angle = Math.PI - (Math.min(value, SCALE_MAX) / SCALE_MAX) * Math.PI
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle)
  }
}

function arcPath(from: number, to: number) {
  const p1 = polar(from)
  const p2 = polar(to)
  // Minor arc (large-arc-flag 0), sweep-flag 1 traces left -> top -> right,
  // matching the value=0..SCALE_MAX direction above.
  return `M ${p1.x} ${p1.y} A ${R} ${R} 0 0 1 ${p2.x} ${p2.y}`
}

export default function AqiGauge({
  value,
  level,
  detail
}: {
  value: number
  level: AqiLevel
  // ConditionBanner's old headline/detail text (from buildConditionAlert) —
  // "Current AQI is X in {area}, {state}." normally, or the "expected to
  // worsen" forecast warning when the forecast is notably higher than the
  // current reading. Shown as the gauge's caption so that context isn't
  // lost now that the gauge has absorbed ConditionBanner's role.
  detail?: string | null
}) {
  const needle = polar(value)
  const color = aqiColor[level]

  return (
    <div className="flex flex-col items-center px-4 pt-4 pb-1 border-b border-ink-200 dark:border-night-600">
      <svg width="220" height="128" viewBox="0 0 240 140" className="overflow-visible">
        {SEGMENTS.map((seg) => (
          <path
            key={seg.level}
            d={arcPath(seg.from, seg.to)}
            stroke={aqiColor[seg.level]}
            strokeWidth={14}
            strokeLinecap="butt"
            fill="none"
          />
        ))}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          className="stroke-ink-900 dark:stroke-night-100"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} className="fill-ink-900 dark:fill-night-100" />
      </svg>
      <div className="-mt-6 text-center">
        <p className="text-4xl font-semibold m-0 tabular-nums" style={{ color }}>
          {Math.round(value)}
        </p>
        <p className="text-sm font-medium m-0 mt-0.5" style={{ color }}>
          {aqiLevelLabel[level]}
        </p>
        {detail && (
          <p className="text-xs text-ink-500 dark:text-night-300 m-0 mt-1 max-w-[240px]">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
