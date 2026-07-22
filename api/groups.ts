// Real Groups/Leaderboards backend, consolidated into a single serverless
// function (all actions routed through one `action` query param) to stay
// well under Vercel Hobby's 12-function-per-deployment cap — same pattern
// used earlier for the Strava endpoints before those were removed.
//
// Storage: Upstash Redis via Vercel's KV integration (KV_REST_API_URL /
// KV_REST_API_TOKEN — already provisioned for this project, genuinely
// free tier, no new signup needed). Talks to Upstash's REST API directly
// with plain fetch() rather than pulling in the @upstash/redis SDK, to
// avoid adding a new dependency for what's ultimately a handful of
// single commands (SET/GET/HSET/HGETALL/ZADD/ZRANGE/SADD/SREM/etc).
//
// Data model, all scoped under a per-group 6-character join code:
//   group:{code}:name            -> string, the group's display name
//   group:{code}:members         -> hash { deviceId: displayName }
//   group:{code}:scores          -> sorted set { deviceId: score }, score is
//                                    this app's own 0-100 exposure score
//                                    (see services/exposureScore.ts) —
//                                    each member's own device pushes its
//                                    own score in, nothing is invented
//                                    server-side.
//   device:{deviceId}:groups     -> set of codes this device has joined
//
// There are no real user accounts anywhere in this app, so "who is this"
// is only ever the anonymous per-device id from services/device.ts —
// good enough to let the same browser rejoin a group and see/update its
// own row, not a claim of verified identity.
const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

async function redis(command: (string | number)[]): Promise<any> {
  const res = await fetch(KV_URL as string, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  })
  const data = await res.json()
  if (data?.error) throw new Error(String(data.error))
  return data?.result
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity

function randomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

interface LeaderboardEntry {
  deviceId: string
  displayName: string
  score: number | null
}

async function buildLeaderboard(code: string): Promise<LeaderboardEntry[]> {
  const membersFlat: string[] = (await redis(['HGETALL', `group:${code}:members`])) ?? []
  const memberNames: Record<string, string> = {}
  for (let i = 0; i < membersFlat.length; i += 2) {
    memberNames[membersFlat[i]] = membersFlat[i + 1]
  }

  const scoresFlat: string[] =
    (await redis(['ZRANGE', `group:${code}:scores`, 0, -1, 'REV', 'WITHSCORES'])) ?? []

  const ranked: LeaderboardEntry[] = []
  const seen = new Set<string>()
  for (let i = 0; i < scoresFlat.length; i += 2) {
    const deviceId = scoresFlat[i]
    seen.add(deviceId)
    ranked.push({ deviceId, displayName: memberNames[deviceId] ?? 'Member', score: Number(scoresFlat[i + 1]) })
  }

  // Members who joined but haven't submitted a score yet still show up,
  // just without a rank position — never silently dropped from the list.
  for (const deviceId of Object.keys(memberNames)) {
    if (!seen.has(deviceId)) {
      ranked.push({ deviceId, displayName: memberNames[deviceId], score: null })
    }
  }

  return ranked
}

export default async function handler(req: any, res: any) {
  if (!KV_URL || !KV_TOKEN) {
    res.status(501).json({ error: 'Redis is not configured on the server.' })
    return
  }

  const action = String(req.query.action ?? '')

  try {
    if (req.method === 'POST' && action === 'create') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId, displayName, groupName, score } = body
      if (!deviceId || !displayName || !groupName) {
        res.status(400).json({ error: 'Expected deviceId, displayName, and groupName.' })
        return
      }

      let code = randomCode()
      for (let attempt = 0; attempt < 5; attempt++) {
        const exists = await redis(['EXISTS', `group:${code}:name`])
        if (!exists) break
        code = randomCode()
      }

      await redis(['SET', `group:${code}:name`, String(groupName).slice(0, 60)])
      await redis(['HSET', `group:${code}:members`, deviceId, String(displayName).slice(0, 40)])
      if (typeof score === 'number') {
        await redis(['ZADD', `group:${code}:scores`, score, deviceId])
      }
      await redis(['SADD', `device:${deviceId}:groups`, code])

      res.status(200).json({ code, name: groupName })
      return
    }

    if (req.method === 'POST' && action === 'join') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId, displayName, score } = body
      const code = String(body.code ?? '').toUpperCase()
      if (!deviceId || !displayName || !code) {
        res.status(400).json({ error: 'Expected deviceId, displayName, and code.' })
        return
      }

      const name = await redis(['GET', `group:${code}:name`])
      if (!name) {
        res.status(404).json({ error: 'No group found with that code. Double-check it and try again.' })
        return
      }

      await redis(['HSET', `group:${code}:members`, deviceId, String(displayName).slice(0, 40)])
      if (typeof score === 'number') {
        await redis(['ZADD', `group:${code}:scores`, score, deviceId])
      }
      await redis(['SADD', `device:${deviceId}:groups`, code])

      res.status(200).json({ code, name })
      return
    }

    if (req.method === 'POST' && action === 'leave') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId } = body
      const code = String(body.code ?? '').toUpperCase()
      if (!deviceId || !code) {
        res.status(400).json({ error: 'Expected deviceId and code.' })
        return
      }

      await redis(['HDEL', `group:${code}:members`, deviceId])
      await redis(['ZREM', `group:${code}:scores`, deviceId])
      await redis(['SREM', `device:${deviceId}:groups`, code])

      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'POST' && action === 'submitScore') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId, score } = body
      const code = String(body.code ?? '').toUpperCase()
      if (!deviceId || !code || typeof score !== 'number') {
        res.status(400).json({ error: 'Expected deviceId, code, and a numeric score.' })
        return
      }

      await redis(['ZADD', `group:${code}:scores`, score, deviceId])
      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'GET' && action === 'leaderboard') {
      const code = String(req.query.code ?? '').toUpperCase()
      if (!code) {
        res.status(400).json({ error: 'Expected a code query param.' })
        return
      }

      const name = await redis(['GET', `group:${code}:name`])
      if (!name) {
        res.status(404).json({ error: 'No group found with that code.' })
        return
      }

      const leaderboard = await buildLeaderboard(code)
      res.status(200).json({ code, name, leaderboard })
      return
    }

    if (req.method === 'GET' && action === 'mine') {
      const deviceId = String(req.query.deviceId ?? '')
      if (!deviceId) {
        res.status(400).json({ error: 'Expected a deviceId query param.' })
        return
      }

      const codes: string[] = (await redis(['SMEMBERS', `device:${deviceId}:groups`])) ?? []
      const groups: { code: string; name: string }[] = []
      for (const code of codes) {
        const name = await redis(['GET', `group:${code}:name`])
        if (name) groups.push({ code, name })
      }

      res.status(200).json({ groups })
      return
    }

    res.status(400).json({ error: 'Unknown or missing action.' })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Redis request failed.' })
  }
}
