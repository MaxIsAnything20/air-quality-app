// Deletes the stored token record and best-effort asks Strava to revoke
// it. Revocation failing (e.g. token already expired) doesn't block
// disconnecting on our end -- we still drop our own copy so the app shows
// "disconnected" either way.
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed' })
          return
    }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId : null
    if (!deviceId) {
          res.status(400).json({ error: 'Expected { deviceId }.' })
          return
    }

  const key = `strava:tokens:${deviceId}`
    const record = (await redis.get(key)) as { accessToken: string } | null

  if (record?.accessToken) {
        try {
                await fetch('https://www.strava.com/oauth/deauthorize', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ access_token: record.accessToken })
                })
        } catch {
                // Best-effort -- still delete our copy below.
        }
  }

  await redis.del(key)
    res.status(200).json({ ok: true })
}
