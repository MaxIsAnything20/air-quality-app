// Combined Strava OAuth authorize + callback handler.
// GET /api/strava/oauth?deviceId=<id>          -> redirect to Strava's consent screen
// GET /api/strava/oauth?code=<code>&state=<id>  -> Strava's redirect back after consent; exchanges code for tokens
//
// Strava requires the authorization callback domain to be pre-registered in
// the app's settings (strava.com/settings/api) -- it does NOT need the full
// path, just the bare domain (e.g. air-quality-app-rouge-six.vercel.app).
// The callback URL itself is derived from the incoming request's host so
// this works unmodified on both the production domain and preview
// deployments, as long as each host you test from is also added to
// Strava's "Authorization Callback Domain" field.
import { Redis } from '@upstash/redis'

export default async function handler(req: any, res: any) {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

  const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const redirectUri = proto + '://' + host + '/api/strava/oauth'
    const appUrl = proto + '://' + host

  const code = typeof req.query?.code === 'string' ? req.query.code : null

  if (!code) {
        if (!clientId) {
                res.status(501).json({ error: 'STRAVA_CLIENT_ID is not set on the server.' })
                return
        }
        const deviceId = typeof req.query?.deviceId === 'string' ? req.query.deviceId : null
        if (!deviceId) {
                res.status(400).json({ error: 'Expected ?deviceId=<id>.' })
                return
        }
        const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                approval_prompt: 'auto',
                scope: 'activity:read_all',
                state: deviceId
        })
        res.writeHead(302, { Location: 'https://www.strava.com/oauth/authorize?' + params })
        res.end()
        return
  }

  const deviceId = typeof req.query?.state === 'string' ? req.query.state : null
    if (!deviceId) {
          res.writeHead(302, { Location: appUrl + '/?stravaError=missing_state' })
          res.end()
          return
    }
    if (!clientId || !clientSecret) {
          res.writeHead(302, { Location: appUrl + '/?stravaError=not_configured' })
          res.end()
          return
    }

  try {
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                          client_id: clientId,
                          client_secret: clientSecret,
                          code: code,
                          grant_type: 'authorization_code'
                })
        })

      if (!tokenRes.ok) {
              res.writeHead(302, { Location: appUrl + '/?stravaError=token_exchange_failed' })
              res.end()
              return
      }

      const data = await tokenRes.json()
        const redis = Redis.fromEnv()
        await redis.set('strava:tokens:' + deviceId, {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_at,
                athlete: {
                          firstname: data.athlete?.firstname ?? '',
                          lastname: data.athlete?.lastname ?? '',
                          profile: data.athlete?.profile ?? ''
                }
        })

      res.writeHead(302, { Location: appUrl + '/?stravaConnected=1' })
        res.end()
  } catch (err) {
        res.writeHead(302, { Location: appUrl + '/?stravaError=network_error' })
        res.end()
  }
}
