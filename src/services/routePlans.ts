// A real, honest usage counter — not a server-enforced entitlement (this
// app has no accounts or backend billing, see resetData.ts/services/profile.ts
// for the same "everything lives in this browser" pattern), just an actual
// count of how many times a route has been planned on this device, so the
// "free plans remaining" UI in RoutePlanningView.tsx reflects something
// real instead of a static, meaningless number.
const ROUTE_PLAN_COUNT_KEY = 'respira.routePlanCount.v1'

export const FREE_ROUTE_PLAN_LIMIT = 3

// Temporary: route planning is unlimited while the paywall isn't wired up
// to real billing yet, per an explicit ask to lift the cap for now. The
// counter below keeps counting in the background either way (so history
// isn't lost), but hasFreeRoutePlansRemaining() ignores it while this is
// true. Flip this back to false to restore the 3-free-plan limit —
// nothing else needs to change, since every caller (useRoutePlanning,
// RoutePlanningView's notice copy) reads through this single flag.
export const UNLIMITED_ROUTE_PLANS = true

export function getRoutePlanCount(): number {
  try {
    const raw = localStorage.getItem(ROUTE_PLAN_COUNT_KEY)
    const parsed = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    // localStorage may be unavailable (private mode, quota) — treat as
    // "nothing used yet" rather than crashing the route planner.
    return 0
  }
}

export function incrementRoutePlanCount(): number {
  const next = getRoutePlanCount() + 1
  try {
    localStorage.setItem(ROUTE_PLAN_COUNT_KEY, String(next))
  } catch {
    // Best-effort — see getRoutePlanCount().
  }
  return next
}

export function hasFreeRoutePlansRemaining(): boolean {
  if (UNLIMITED_ROUTE_PLANS) return true
  return getRoutePlanCount() < FREE_ROUTE_PLAN_LIMIT
}
