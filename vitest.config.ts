import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts (which owns the dev server + API proxy
// middleware) so `npm test` doesn't need to spin any of that up — just
// jsdom for localStorage-backed modules (alertSettings.ts, profile.ts)
// plus plain Node for everything else.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
