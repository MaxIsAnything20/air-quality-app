import { ExposureStats } from '../types'

export default function StatStrip({ stats }: { stats: ExposureStats }) {
  // "Current AQI" used to live here too, but AqiGauge now owns that number
  // as the screen's primary focal point — repeating it here was a
  // redundant status surface (see UI rebuild notes). Only the two stats
  // the gauge doesn't already show remain.
  //
  // Label / big value / small sublabel mirrors the card pattern HistoryView
  // already uses for its "This month" / "Average AQI" / "Peak day" stats —
  // matching it here means a value like "0 days" reads the same way
  // ("unhealthy or worse") no matter which screen it shows up on, instead
  // of inventing a second, differently-worded pattern for the same number.
  const items = [
    { label: 'This month', value: `${stats.daysUnhealthyThisMonth} days`, sublabel: 'unhealthy or worse' },
    { label: 'Forecast peak', value: String(stats.forecastPeakAqi), sublabel: 'AQI' }
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
          // flex-1 (now that only 2 boxes remain) lets them split the row
          // evenly instead of leaving dead space where "Current AQI" was.
          className="shrink-0 flex-1 min-w-[100px] bg-ink-100 dark:bg-night-700 rounded-xl px-3 py-2.5"
        >
          <p className="text-xs text-ink-600 dark:text-night-200 m-0 whitespace-nowrap">{item.label}</p>
          <p className="text-xl font-medium tabular-nums text-ink-900 dark:text-night-100 m-0 mt-1 whitespace-nowrap">
            {item.value}
          </p>
          <p className="text-[11px] text-ink-400 dark:text-night-400 m-0 mt-0.5 whitespace-nowrap">
            {item.sublabel}
          </p>
        </div>
      ))}
    </div>
  )
}
