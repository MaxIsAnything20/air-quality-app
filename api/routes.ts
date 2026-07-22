// Free, open-source turn-by-turn directions via the OSRM public demo
// server (router.project-osrm.org), sponsored by FOSSGIS — no signup, no
// API key, no billing account of any kind required. This replaced an
// earlier OpenRouteService-based proxy (which needed
// OPENROUTESERVICE_API_KEY set in the hosting provider's dashboard)
// specifically because OSRM's demo server needs none, removing a signup
// step entirely.
//
// Trade-off, spelled out in OSRM's own usage policy
// (https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy):
// it's for "reasonable, non-commercial use" only, informally capped
// around 1 request/second — comfortably enough for a personal project's
// traffic, but not something to point a high-volume commercial product
// at. If this app ever needs that scale, self-hosting OSRM (it's open
// source) or a paid provider would be the next step — not needed now.
//
// The client only ever talks to this endpoint, never
// router.project-osrm.org directly — same "proxy hides the upstream"
// pattern as api/airnow.ts, kept even though there's no secret to hide
// here, so switching backends again later stays a one-file change.
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1'

// Respira's own profile names (unchanged from the earlier ORS-based
// version, so nothing else in the app needed to change — see
// src/services/routes.ts) map onto OSRM's own profile path segments.
const OSRM_PROFILE: Record<string, string> = {
  'foot-walking': 'walking',
  'cycling-regular': 'cycling'
}

export default async function handler(req: any, res: any) {
  const incoming = new URL(req.url ?? '', 'http://localhost')
  const requestedProfile = incoming.searchParams.get('profile') || 'foot-walking'
  const profile = OSRM_PROFILE[requestedProfile] ?? 'walking'
  const start = incoming.searchParams.get('start')
  const end = incoming.searchParams.get('end')
  const wantAlternatives = incoming.searchParams.get('alternatives') === 'true'

  if (!start || !end) {
    res.status(400).json({ error: 'Expected "start" and "end" query params as "lng,lat".' })
    return
  }

  try {
    // OSRM takes coordinates as "lng,lat;lng,lat" directly in the path —
    // start/end already arrive in that "lng,lat" shape from
    // src/services/routes.ts, so they're passed straight through.
    const params = new URLSearchParams({ overview: 'full', geometries: 'geojson' })
    if (wantAlternatives) params.set('alternatives', 'true')

    const upstream = await fetch(`${OSRM_BASE_URL}/${profile}/${start};${end}?${params}`)

    // Deliberately NOT gating on upstream.ok before reading the body:
    // OSRM returns a real JSON payload — {code, message} — on BOTH
    // success (code: 'Ok') AND known failure cases like "no route
    // exists between these points" (code: 'NoRoute'/'NoSegment'), and
    // it sends the latter with a 400 HTTP status, not 200. Checking
    // upstream.ok first would swallow that real "no route" message and
    // misreport it as a generic connectivity failure instead — verified
    // by hand against the live demo server before shipping this.
    const data = await upstream.json().catch(() => null)

    if (!data) {
      res.status(502).json({ error: 'Could not reach the routing service.' })
      return
    }

    if (data.code !== 'Ok') {
      // Covers both NoRoute (points aren't connected by any road/trail
      // this profile can use) and NoSegment (a point is too far from
      // any road for OSRM to snap it) — see
      // https://project-osrm.org/docs/v5.24.0/api/#responses. Turned
      // into a 400 the client's isNoRouteMessage() already knows how to
      // detect and show as a friendly "route not possible" message.
      res.status(400).json({ error: data.message ?? 'No route exists between these two points.' })
      return
    }

    res.status(200).json(data)
  } catch {
    res.status(502).json({ error: 'Could not reach the routing service.' })
  }
}
