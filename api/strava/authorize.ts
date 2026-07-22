// Redirects the browser to Strava's OAuth consent screen. Strava requires
// the authorization callback domain to be pre-registered in the app's
// settings (strava.com/settings/api) -- it does NOT need the full path,
// just the bare domain (e.g. air-quality-app-rouge-six.vercel.app). The
// callback URL itself is derived from the incoming request's host so this
// works unmodified on both the production domain and preview deployments,
// as long as each host you test from is also added to Strava's
// "Authorization Callback Domain" field.
export default async function handler(req: any, res: any) {
    const clientId = process.env.STRAVA_CLIENT_ID
    if (!clientId) {
          res.status(501).json({ error: 'STRAVA_CLIENT_ID is not set on the server.' })
          return
    }

  const deviceId = typeof req.query?.deviceId === 'string' ? req.query.deviceId : null
    if (!deviceId) {
          res.status(400).json({ error: 'Expected ?deviceId=<id>.' })
          return
    }

  const proto = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const redirectUri = `${proto}://${host}/api/strava/callback`

  const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: 'activity:read_all',
        state: deviceId
  })

  res.writeHead(302, { Location: `https://www.strava.com/oauth/authorize?${params}` })
    res.end()
}
