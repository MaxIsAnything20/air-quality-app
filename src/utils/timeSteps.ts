// A "step" is either 'today', 'tomorrow', or an ISO date string (a past
// day from mapSnapshotLog.ts). Shared here so the map slider, the AI
// summary's tense, and the summary card's badge all agree on what a given
// step means and how to describe it — previously this lived only in
// MapView.tsx, which is how the region-click summary ended up saying "is
// currently X" for a reading that was actually from three days ago or
// tomorrow's forecast.
export function formatStepLabel(step: string): string {
  if (step === 'today') return 'Today'
  if (step === 'tomorrow') return 'Tomorrow (forecast)'
  const [, month, day] = step.split('-').map(Number)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${MONTHS[(month ?? 1) - 1]} ${day}`
}

export type StepKind = 'today' | 'tomorrow' | 'past'

export function kindOfStep(step: string): StepKind {
  if (step === 'today') return 'today'
  if (step === 'tomorrow') return 'tomorrow'
  return 'past'
}

/** The verb phrase to use when describing a reading from this step —
 *  "is currently" for today, "is forecast to be" for tomorrow, "was" for
 *  a past day. Get this wrong and a forecast reads as if it already
 *  happened, or a three-day-old reading reads as live. */
export function tenseFor(step: string): string {
  const kind = kindOfStep(step)
  if (kind === 'today') return 'is currently'
  if (kind === 'tomorrow') return 'is forecast to be'
  return 'was'
}
