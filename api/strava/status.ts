// Tells the Connections screen whether this browser has a live Strava
// connection, and who (first name/last name/avatar) if so. deviceId is
// the same random localStorage-backed id used by authorize.ts/callback.ts
// -- see callback.ts's header comment for why there's no real account
// system here.
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

interface StravaTokenRecord {
    accessToken: string
    refreshToken: string
    expiresAt: number
    athlete: { firstname: string; lastname: string; profile: string } | null
}

export default async function handler(req: any, res: any) {
    const deviceId = typeof req.query?.deviceId === 'string' ? req.query.deviceId : null
    if (!deviceId) {
          res.status(400).json({ error: 'Expected ?deviceId=<id>.' })
          return
    }

  const record = (await redis.get(`strava:tokens:${deviceId}`)) as StravaTokenRecord | null

  res.status(200).json({ connected: !!record, athlete: record?.athlete ?? null })
}
