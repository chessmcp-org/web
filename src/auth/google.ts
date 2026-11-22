import { config } from '../config'

export function googleAuthUrl(state: string, cfg = config): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', cfg.googleClientId)
  u.searchParams.set('redirect_uri', `${cfg.baseUrl}/login`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('state', state)
  u.searchParams.set('prompt', 'select_account')
  return u.toString()
}

/** Exchanges the auth code for the user's identity. */
export async function exchangeCode(code: string, cfg = config): Promise<{ sub: string; email: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: cfg.googleClientId,
      client_secret: cfg.googleClientSecret,
      redirect_uri: `${cfg.baseUrl}/login`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`)
  const { id_token } = (await res.json()) as { id_token?: string }
  if (!id_token) throw new Error('Google response had no id_token')
  // The id_token arrives directly from Google's token endpoint over TLS in response to our
  // client-secret-authenticated request, so its signature need not be re-verified (OIDC Core 3.1.3.7).
  const claims = JSON.parse(Buffer.from(id_token.split('.')[1] ?? '', 'base64url').toString())
  if (claims.aud !== cfg.googleClientId || !claims.sub || !claims.email) throw new Error('Unexpected id_token claims')
  return { sub: String(claims.sub), email: String(claims.email) }
}
