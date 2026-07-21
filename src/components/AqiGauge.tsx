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
    // Blue gradient hero (continues the header's blue from App.tsx into
    // one seamless panel) — modeled on AirNow's own home screen, where the
    // dial sits on a bold blue field rather than blending into the page.
    // The readout below the dial gets its own light card instead of
    // sitting directly on the blue, since AQI category colors (especially
    // the darker hazardous maroon) can't be guaranteed to stay legible
    // against every shade of blue — a light card sidesteps that entirely.
    <div className="bg-gradient-to-b from-[#2E6DA4] to-[#4A9FD8] dark:from-[#0F2A47] dark:to-[#123A5E] flex flex-col items-center px-4 pt-1 pb-5 rounded-b-[28px]">
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
        <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="white" strokeWidth={3} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={5} fill="white" />

        {/* Scale endpoints (0 / 300+) so the needle's position reads as a
            point on a known range at a glance, not just "somewhere on an
            arc" — without these two numbers, first-time users have no
            sense of how close to the top of the scale a reading is. */}
        <text x={CX - R} y={CY + 18} textAnchor="middle" fill="white" fillOpacity={0.75} style={{ fontSize: 10 }}>
          0
        </text>
        <text x={CX + R} y={CY + 18} textAnchor="middle" fill="white" fillOpacity={0.75} style={{ fontSize: 10 }}>
          300+
        </text>
      </svg>

      <div className="-mt-3 text-center bg-white/95 dark:bg-night-900/90 rounded-2xl px-6 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
        <div className="flex items-baseline justify-center gap-1">
          <p className="text-4xl font-semibold m-0 tabular-nums" style={{ color }}>
            {Math.round(value)}
          </p>
          {/* Labels the big number as an AQI reading on its own, so it's
              unambiguous even if someone lands on this screen without
              reading the caption below (or the word "AQI" elsewhere). */}
          <span className="text-xs font-medium text-ink-400 dark:text-night-400">AQI</span>
        </div>
        <p className="text-sm font-medium m-0 mt-0.5" style={{ color }}>
          {aqiLevelLabel[level]}
        </p>
        {detail && (
          <p className="text-xs text-ink-500 dark:text-night-300 m-0 mt-1 max-w-[220px]">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
