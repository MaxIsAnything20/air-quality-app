import type { ManeuverModifier, ManeuverType, NavigationStep } from './routes'

// Turns OSRM's raw maneuver vocabulary (type + modifier — see
// https://project-osrm.org/docs/v5.24.0/api/#stepmaneuver-object) into the
// spoken/written instructions and icon this app actually shows. Every
// value in ManeuverType/ManeuverModifier (routes.ts) is handled here, at
// least by falling through to a reasonable generic phrasing — nothing
// silently produces an empty instruction.

export type ManeuverIcon =
  | 'straight'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'sharp-left'
  | 'left'
  | 'slight-left'
  | 'roundabout'
  | 'depart'
  | 'arrive'

const MODIFIER_ICON: Record<ManeuverModifier, ManeuverIcon> = {
  uturn: 'uturn',
  'sharp right': 'sharp-right',
  right: 'right',
  'slight right': 'slight-right',
  straight: 'straight',
  'slight left': 'slight-left',
  left: 'left',
  'sharp left': 'sharp-left'
}

const ROUNDABOUT_TYPES: ManeuverType[] = ['roundabout', 'rotary', 'roundabout turn']

export function maneuverIcon(step: NavigationStep): ManeuverIcon {
  if (step.maneuverType === 'depart') return 'depart'
  if (step.maneuverType === 'arrive') return 'arrive'
  if (ROUNDABOUT_TYPES.includes(step.maneuverType)) return 'roundabout'
  if (step.maneuverModifier) return MODIFIER_ICON[step.maneuverModifier] ?? 'straight'
  return 'straight'
}

function verbForStep(step: NavigationStep): string {
  const { maneuverType: type, maneuverModifier: modifier } = step
  if (type === 'depart') return 'Head'
  if (ROUNDABOUT_TYPES.includes(type)) return 'Enter the roundabout, then'
  if (type === 'exit roundabout' || type === 'exit rotary') return 'Exit the roundabout'
  if (type === 'merge') return modifier ? `Merge ${modifier}` : 'Merge'
  if (type === 'fork') return modifier ? `Keep ${modifier}` : 'Continue'
  if (type === 'end of road') return modifier ? `Turn ${modifier}` : 'Continue'
  if (type === 'on ramp') return modifier ? `Take the ramp, keeping ${modifier}` : 'Take the ramp'
  if (type === 'off ramp') return modifier ? `Take the exit, keeping ${modifier}` : 'Take the exit'
  if (type === 'new name' || type === 'continue' || type === 'use lane' || type === 'notification') return 'Continue'
  if (!modifier || modifier === 'straight') return 'Continue straight'
  return `Turn ${modifier}`
}

/** Builds the human-facing instruction for a single step — used both for
 * the on-screen instruction card and as the text handed to
 * SpeechSynthesisUtterance for voice guidance (see
 * useTurnByTurnNavigation.ts). isLast marks the final step in the route,
 * which OSRM always tags maneuverType 'arrive' but is passed explicitly
 * so callers don't need to know that detail. */
export function instructionForStep(step: NavigationStep, isLast: boolean): string {
  if (isLast || step.maneuverType === 'arrive') {
    return step.streetName
      ? `Arrive at your destination on ${step.streetName}`
      : 'Arrive at your destination'
  }
  const verb = verbForStep(step)
  return step.streetName ? `${verb} onto ${step.streetName}` : verb
}

/** A short, natural lead-in for an upcoming-turn voice announcement, e.g.
 * "In 200 feet, turn left onto Main St." Distance is rounded to the
 * nearest 50 ft (or 0.1 mi past a quarter mile) so the announcement
 * doesn't read out an oddly precise GPS-noise number. */
export function formatAnnounceDistance(meters: number): string {
  const feet = meters * 3.28084
  if (feet < 50) return 'now'
  if (feet < 1000) return `in ${Math.round(feet / 50) * 50} feet`
  const miles = meters / 1609.34
  if (miles < 0.5) return 'in a quarter mile'
  return `in ${(Math.round(miles * 10) / 10).toFixed(1)} miles`
}
