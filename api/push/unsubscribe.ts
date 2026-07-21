import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const endpoint = body?.endpoint

  if (!endpoint) {
    res.status(400).json({ error: 'Expected { endpoint }.' })
    return
  }

  const key = `push:sub:${endpoint}`
  await redis.del(key)
  await redis.srem('push:subs', key)

  res.status(200).json({ ok: true })
}
