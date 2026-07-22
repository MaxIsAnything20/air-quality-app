// Real Events backend (create/join/check-in), consolidated into a single
// serverless function like api/groups.ts, to stay under Vercel Hobby's
// 12-function-per-deployment cap. This is NOT a public events-discovery
// feed (that would need a paid third-party events API, on the "undone"
// skip list) — it's private, code-based events you create and share with
// people you already know, same shape as Groups.
//
// Storage: the same Upstash Redis REST API used by api/groups.ts.
//
// Data model, scoped under a per-event 6-character join code:
// event:{code}:name -> string, event display name
// event:{code}:startsAt -> string (epoch ms), when the event starts
// event:{code}:location -> string, optional free-text venue/location label
// event:{code}:members -> hash { deviceId: displayName }
// event:{code}:checkins -> hash { deviceId: epoch ms of check-in }
// device:{deviceId}:events -> set of codes this device has joined
//
// Same anonymous per-device identity model as Groups (services/device.ts)
// — no real accounts, "you" is just this browser's device id.

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

interface EventMember {
  deviceId: string
  displayName: string
  checkedInAt: number | null
}

interface EventSummary {
  code: string
  name: string
  startsAt: number | null
  location: string | null
}

async function eventSummary(code: string): Promise<EventSummary | null> {
  const [name, startsAt, location] = await Promise.all([
    redis(['GET', `event:${code}:name`]),
    redis(['GET', `event:${code}:startsAt`]),
    redis(['GET', `event:${code}:location`])
  ])
  if (!name) return null
  return {
    code,
    name,
    startsAt: startsAt != null ? Number(startsAt) : null,
    location: location || null
  }
}

async function buildMembers(code: string): Promise<EventMember[]> {
  const membersFlat: string[] = (await redis(['HGETALL', `event:${code}:members`])) ?? []
  const checkinsFlat: string[] = (await redis(['HGETALL', `event:${code}:checkins`])) ?? []
  const checkins: Record<string, number> = {}
  for (let i = 0; i < checkinsFlat.length; i += 2) {
    checkins[checkinsFlat[i]] = Number(checkinsFlat[i + 1])
  }

  const members: EventMember[] = []
  for (let i = 0; i < membersFlat.length; i += 2) {
    const deviceId = membersFlat[i]
    members.push({
      deviceId,
      displayName: membersFlat[i + 1],
      checkedInAt: checkins[deviceId] ?? null
    })
  }
  return members
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
      const { deviceId, displayName, eventName, startsAt, location } = body
      if (!deviceId || !displayName || !eventName || !startsAt) {
        res.status(400).json({ error: 'Expected deviceId, displayName, eventName, and startsAt.' })
        return
      }

      let code = randomCode()
      for (let attempt = 0; attempt < 5; attempt++) {
        const exists = await redis(['EXISTS', `event:${code}:name`])
        if (!exists) break
        code = randomCode()
      }

      await redis(['SET', `event:${code}:name`, String(eventName).slice(0, 60)])
      await redis(['SET', `event:${code}:startsAt`, Number(startsAt)])
      if (location) {
        await redis(['SET', `event:${code}:location`, String(location).slice(0, 80)])
      }
      await redis(['HSET', `event:${code}:members`, deviceId, String(displayName).slice(0, 40)])
      await redis(['SADD', `device:${deviceId}:events`, code])

      res.status(200).json({ code, name: eventName, startsAt: Number(startsAt), location: location ?? null })
      return
    }

    if (req.method === 'POST' && action === 'join') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId, displayName } = body
      const code = String(body.code ?? '').toUpperCase()
      if (!deviceId || !displayName || !code) {
        res.status(400).json({ error: 'Expected deviceId, displayName, and code.' })
        return
      }

      const summary = await eventSummary(code)
      if (!summary) {
        res.status(404).json({ error: 'No event found with that code. Double-check it and try again.' })
        return
      }

      await redis(['HSET', `event:${code}:members`, deviceId, String(displayName).slice(0, 40)])
      await redis(['SADD', `device:${deviceId}:events`, code])

      res.status(200).json(summary)
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

      await redis(['HDEL', `event:${code}:members`, deviceId])
      await redis(['HDEL', `event:${code}:checkins`, deviceId])
      await redis(['SREM', `device:${deviceId}:events`, code])

      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'POST' && action === 'checkIn') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
      const { deviceId, displayName } = body
      const code = String(body.code ?? '').toUpperCase()
      if (!deviceId || !code) {
        res.status(400).json({ error: 'Expected deviceId and code.' })
        return
      }

      const summary = await eventSummary(code)
      if (!summary) {
        res.status(404).json({ error: 'No event found with that code.' })
        return
      }

      // Checking in implies membership — add the device to the roster if
      // it hadn't already joined (e.g. checked in straight from a shared
      // code without a separate "join" step first).
      if (displayName) {
        await redis(['HSET', `event:${code}:members`, deviceId, String(displayName).slice(0, 40)])
      }
      await redis(['HSET', `event:${code}:checkins`, deviceId, Date.now()])
      await redis(['SADD', `device:${deviceId}:events`, code])

      res.status(200).json({ ok: true, checkedInAt: Date.now() })
      return
    }

    if (req.method === 'GET' && action === 'details') {
      const code = String(req.query.code ?? '').toUpperCase()
      if (!code) {
        res.status(400).json({ error: 'Expected a code query param.' })
        return
      }

      const summary = await eventSummary(code)
      if (!summary) {
        res.status(404).json({ error: 'No event found with that code.' })
        return
      }

      const members = await buildMembers(code)
      res.status(200).json({ ...summary, members })
      return
    }

    if (req.method === 'GET' && action === 'mine') {
      const deviceId = String(req.query.deviceId ?? '')
      if (!deviceId) {
        res.status(400).json({ error: 'Expected a deviceId query param.' })
        return
      }

      const codes: string[] = (await redis(['SMEMBERS', `device:${deviceId}:events`])) ?? []
      const events: (EventSummary & { checkedInAt: number | null })[] = []
      for (const code of codes) {
        const summary = await eventSummary(code)
        if (!summary) continue
        const checkedInAt = await redis(['HGET', `event:${code}:checkins`, deviceId])
        events.push({ ...summary, checkedInAt: checkedInAt != null ? Number(checkedInAt) : null })
      }

      res.status(200).json({ events })
      return
    }

    res.status(400).json({ error: 'Unknown or missing action.' })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Redis request failed.' })
  }
}
