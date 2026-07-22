// Strava redirects here after the user approves (or denies) access. We
// exchange the one-time `code` for an access/refresh token pair and store
// it in Redis keyed by the deviceId we round-tripped through `state`, then
// bounce back to the app so the Connections screen can pick up the new
// status. There's no real account system in this app -- deviceId is a
// random id the client generates once and keeps in localStorage, matching
// the "everything lives in this browser" pattern already used elsewhere
// (see src/services/routePlans.ts, historyLog.ts, etc).
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export default async function handler(req: any, res: any) {
    const { code, state, error } = req.query ?? {}

        const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const appUrl = `${proto}://${host}`

  if (error) {
        res.writeHead(302, { Location: `${appUrl}/?stravaError=${encodeURIComponent(String(error))}` })
        res.end()
        return
  }

  const deviceId = typeof state === 'string' ? state : null
    const authCode = typeof code === 'string' ? code : null
    if (!deviceId || !authCode) {
          res.writeHead(302, { Location: `${appUrl}/?stravaError=missing_code` })
          res.end()
          return
    }

  const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET
    if (!clientId || !clientSecret) {
          res.writeHead(302, { Location: `${appUrl}/?stravaError=not_configured` })
          res.end()
          return
    }

  try {
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                          client_id: clientId,
                          client_secret: clientSecret,
                          code: authCode,
                          grant_type: 'authorization_code'
                })
        })

      if (!tokenRes.ok) {
              res.writeHead(302, { Location: `${appUrl}/?stravaError=token_exchange_failed` })
              res.end()
              return
      }

      const data = await tokenRes.json()
        const { access_token, refresh_token, expires_at, athlete } = data

      await redis.set(`strava:tokens:${deviceId}`, {
              accessToken: access_token,
              refreshToken: refresh_token,
              expiresAt: expires_at,
              athlete: athlete
                ? { firstname: athlete.firstname, lastname: athlete.lastname, profile: athlete.profile }
                        : null
      })

      res.writeHead(302, { Location: `${appUrl}/?stravaConnected=1` })
        res.end()
  } catch {
        res.writeHead(302, { Location: `${appUrl}/?stravaError=network` })
        res.end()
  }
}
