import { ExposureStats } from '../types'

export default function StatStrip({ stats }: { stats: ExposureStats }) {
  const items = [
    { label: 'Current AQI', value: stats.currentAqi },
    { label: 'This month', value: `${stats.daysUnhealthyThisMonth} days` },
    { label: 'Forecast peak', value: stats.forecastPeakAqi }
  ]

  return (
    // shrink-0 HERE is the actual fix for numbers getting clipped at the
    // bottom: this row has overflow-x-auto, and setting overflow-x to
    // anything but visible forces the browser to also compute overflow-y
    // as auto (an element can't have one axis visible and the other not).
    // Once overflow-y isn't visible, this row loses flexbox's normal
    // protection against being shrunk below its content's natural height
    // — so App.tsx's fixed-height flex-col shell was allowed to compress
    // this row (not the boxes inside it) whenever everything above it
    // added up to more than the shell's 780px, slicing a few px off the
    // bottom of whichever line was tallest (the big numbers). shrink-0
    // stops that at the source; the boxes below were never the problem.
    <div className="shrink-0 flex gap-2.5 px-4 py-3 overflow-x-auto border-b border-ink-200 dark:border-night-600">
      {items.map((item) => (
        <div
          key={item.label}
          // shrink-0 is the fix: without it, flex's default shrink:1 was
          // squeezing these boxes narrower than min-w-[100px] intended
          // (min-width only wins the shrink negotiation against flex-basis,
          // not against flex-shrink pulling the whole row below the
          // scroll container's width) — text-xl numbers/"NN days" would
          // then run past the box's actual rendered edge. whitespace-nowrap
          // stops the value from wrapping mid-number as a second line of
          // defense, and tabular-nums keeps digit widths consistent so the
          // three boxes don't visibly jitter in width as values update.
          className="shrink-0 min-w-[100px] bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
        >
          <p className="text-xs text-ink-600 dark:text-night-200 m-0 whitespace-nowrap">{item.label}</p>
          <p className="text-xl font-medium tabular-nums text-ink-900 dark:text-night-100 m-0 mt-1 whitespace-nowrap">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
