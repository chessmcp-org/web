export type Config = {
  googleClientId: string
  googleClientSecret: string
  sessionSecret: string
  baseUrl: string
  port: number
}

type Env = Record<string, string | undefined>

/** Reads UPPER_CASE names (DO) or lower_case names (local .env). Production = https BASE_URL or NODE_ENV=production: secrets are mandatory. */
export function loadConfig(env: Env = process.env): Config {
  const get = (name: string) => env[name.toUpperCase()] ?? env[name.toLowerCase()]
  const port = Number(get('PORT') ?? 3000)
  const baseUrl = (get('BASE_URL') ?? `http://localhost:${port}`).replace(/\/$/, '')
  const production = baseUrl.startsWith('https://') || get('NODE_ENV') === 'production'
  const googleClientId = get('GOOGLE_CLIENT_ID') ?? ''
  const googleClientSecret = get('GOOGLE_CLIENT_SECRET') ?? ''
  const sessionSecret = get('SESSION_SECRET') ?? (production ? '' : 'dev-only-insecure-secret')
  if (production) {
    const missing = [
      ['GOOGLE_CLIENT_ID', googleClientId],
      ['GOOGLE_CLIENT_SECRET', googleClientSecret],
      ['SESSION_SECRET', sessionSecret],
    ].filter(([, v]) => !v)
    if (missing.length) throw new Error(`Missing required env: ${missing.map(([k]) => k).join(', ')}`)
  }
  return { googleClientId, googleClientSecret, sessionSecret, baseUrl, port }
}

export const config = loadConfig()
