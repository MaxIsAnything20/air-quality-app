// Thrown by client services when the server-side layer (Vite dev middleware
// or the /api/* serverless functions in production) reports that a required
// key isn't configured — as opposed to a network failure or upstream outage.
// Kept distinct so the UI can show "add a key" messaging instead of a
// generic "showing sample data" banner where that distinction matters
// (see purpleAirMissingKey in useAirQuality.ts).
export class ApiNotConfiguredError extends Error {}
