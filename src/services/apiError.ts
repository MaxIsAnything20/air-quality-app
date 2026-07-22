// Thrown by client services when the server-side layer (Vite dev middleware
// or the /api/* serverless functions in production) reports that a required
// key isn't configured — as opposed to a network failure or upstream outage.
// Kept distinct so the UI can show "add a key" messaging instead of a
// generic "showing sample data" banner where that distinction matters
// (see purpleAirMissingKey in useAirQuality.ts).
export class ApiNotConfiguredError extends Error {}

// Thrown when the routing engine itself reports it cannot connect the two
// chosen points at all for the chosen activity (e.g. they're on separate
// islands with no bridge, or otherwise not linked by any road/trail it
// knows about) — as opposed to a network hiccup or a missing API key. Kept
// distinct so the UI can show a clear "this route isn't possible" message
// instead of a generic "something went wrong, try again" one.
export class RouteNotPossibleError extends Error {}
