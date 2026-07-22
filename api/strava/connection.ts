// Combined Strava connection status + disconnect handler.
// GET  /api/strava/connection?deviceId=<id>  -> { connected, athlete }
// POST /api/strava/connection { deviceId }    -> revokes and deletes the stored tokens
import { Redis } from '@upstash/redis'

export default async function handler(req: any, res: any) {
    const redis = Redis.fromEnv()

  if (req.method === 'GET') {
        const deviceId = typeof req.query?.deviceId === 'string' ? req.query.deviceId : null
        if (!deviceId) {
                res.status(400).json({ error: 'Expected ?deviceId=<id>.' })
                return
        }
        const record: any = await redis.get('strava:tokens:' + deviceId)
        res.status(200).json({ connected: !!record, athlete: record?.athlete ?? null })
        return
  }

  if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
        const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : null
        if (!deviceId) {
                res.status(400).json({ error: 'Expected { deviceId } in the request body.' })
                return
        }
        const key = 'strava:tokens:' + deviceId
        const record: any = await redis.get(key)
        if (record?.accessToken) {
                try {
                          await fetch('https://www.strava.com/oauth/deauthorize', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                      body: 'access_token=' + encodeURIComponent(record.accessToken)
                          })
                } catch (err) {
                          // best-effort revoke; fall through to delete the local record regardless
                }
        }
        await redis.del(key)
        res.status(200).json({ ok: true })
        return
  }

  res.status(405).json({ error: 'Method not allowed.' })
}
