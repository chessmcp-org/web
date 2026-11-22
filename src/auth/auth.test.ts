import { describe, expect, test } from 'bun:test'
import { authRoutes } from './routes'
import { makeSessionCookie, readSession } from './session'
import { sign, verify } from './sign'
import { makeMcpToken, verifyMcpToken } from './token'
import { loadConfig } from '../config'

const SECRET = 'test-secret-1'
const cfg = { googleClientId: 'cid', googleClientSecret: 'csec', sessionSecret: SECRET, baseUrl: 'http://localhost:3000', port: 3000 }

describe('sign/verify', () => {
  test('round trips values containing dots', () => {
    expect(verify(sign('a.b.c', SECRET), SECRET)).toBe('a.b.c')
  })
  test('rejects a tampered value, a tampered signature, a wrong secret and junk', () => {
    const s = sign('hello', SECRET)
    expect(verify(s.replace('hello', 'hellO'), SECRET)).toBeNull()
    expect(verify(s.slice(0, -2) + 'xx', SECRET)).toBeNull()
    expect(verify(s, 'other')).toBeNull()
    expect(verify('nodot', SECRET)).toBeNull()
    expect(verify('', SECRET)).toBeNull()
  })
})

describe('mcp token', () => {
  test('round trips and returns the sub', () => {
    expect(verifyMcpToken(makeMcpToken('12345', SECRET), SECRET)).toBe('12345')
  })
  test('different users get different tokens', () => {
    expect(makeMcpToken('1', SECRET)).not.toBe(makeMcpToken('2', SECRET))
  })
  test('truncated, swapped and wrong-secret tokens are rejected', () => {
    const t = makeMcpToken('12345', SECRET)
    expect(verifyMcpToken(t.slice(0, -3), SECRET)).toBeNull()
    expect(verifyMcpToken(makeMcpToken('99999', SECRET).split('.')[0] + '.' + t.split('.')[1], SECRET)).toBeNull()
    expect(verifyMcpToken(t, 'other')).toBeNull()
    expect(verifyMcpToken('', SECRET)).toBeNull()
    expect(verifyMcpToken('garbage', SECRET)).toBeNull()
  })
  test('a session signature cannot be used as an mcp token', () => {
    const cookie = makeSessionCookie({ sub: '12345', email: 'a@b.c' }, SECRET)
    expect(verifyMcpToken(cookie, SECRET)).toBeNull()
  })
})

describe('session cookie', () => {
  const user = { sub: '12345', email: 'a@b.c' }
  test('round trips', () => {
    const v = makeSessionCookie(user, SECRET)
    expect(readSession(`foo=bar; session=${v}; x=y`, SECRET)).toEqual(user)
  })
  test('rejects tampered payload (replay as another sub), wrong secret, expired and missing', () => {
    const v = makeSessionCookie(user, SECRET)
    const [payload, sig] = [v.slice(0, v.lastIndexOf('.')), v.slice(v.lastIndexOf('.') + 1)]
    const forged = Buffer.from(JSON.stringify({ sub: '99999', email: 'evil@x.y', exp: Date.now() + 1e9 })).toString('base64url')
    expect(readSession(`session=${forged}.${sig}`, SECRET)).toBeNull()
    expect(readSession(`session=${payload}.${sig}`, 'other')).toBeNull()
    expect(readSession(`session=${makeSessionCookie(user, SECRET, -1000)}`, SECRET)).toBeNull()
    expect(readSession(undefined, SECRET)).toBeNull()
    expect(readSession('other=1', SECRET)).toBeNull()
  })
})

describe('config', () => {
  test('reads lowercase or uppercase env names', () => {
    expect(loadConfig({ google_client_id: 'a', google_client_secret: 'b' }).googleClientId).toBe('a')
    expect(loadConfig({ GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 'd' }).googleClientSecret).toBe('d')
  })
  test('https base url without secrets throws', () => {
    expect(() => loadConfig({ BASE_URL: 'https://chessmcp.org' })).toThrow(/SESSION_SECRET|GOOGLE/)
  })
})

describe('/login', () => {
  const app = authRoutes({ config: cfg, exchangeCode: async (code) => ({ sub: 'g-' + code, email: 'u@example.com' }) })
  const setCookies = (res: Response) => res.headers.getSetCookie()

  test('without a code redirects to Google with a state and sets a signed state cookie', async () => {
    const res = await app.request('/login')
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(loc.searchParams.get('client_id')).toBe('cid')
    expect(loc.searchParams.get('redirect_uri')).toBe('http://localhost:3000/login')
    expect(loc.searchParams.get('scope')).toBe('openid email profile')
    expect(loc.searchParams.get('state')).toBeTruthy()
    expect(setCookies(res).some((c) => c.startsWith('oauth_state=') && /HttpOnly/i.test(c))).toBe(true)
  })

  test('wrong or missing state returns 400 and sets no session', async () => {
    const start = await app.request('/login')
    const stateCookie = setCookies(start).find((c) => c.startsWith('oauth_state='))!.split(';')[0]!
    const wrong = await app.request('/login?code=x&state=wrong', { headers: { cookie: stateCookie } })
    expect(wrong.status).toBe(400)
    expect(setCookies(wrong).some((c) => c.startsWith('session='))).toBe(false)
    const missing = await app.request('/login?code=x&state=whatever')
    expect(missing.status).toBe(400)
    expect(setCookies(missing).some((c) => c.startsWith('session='))).toBe(false)
  })

  test('a correct state logs the user in and redirects to /dashboard', async () => {
    const start = await app.request('/login')
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!
    const stateCookie = setCookies(start).find((c) => c.startsWith('oauth_state='))!.split(';')[0]!
    const res = await app.request(`/login?code=abc&state=${state}`, { headers: { cookie: stateCookie } })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/dashboard')
    const sess = setCookies(res).find((c) => c.startsWith('session='))!
    expect(/HttpOnly/i.test(sess) && /SameSite=Lax/i.test(sess)).toBe(true)
    expect(readSession(sess.split(';')[0], SECRET)).toEqual({ sub: 'g-abc', email: 'u@example.com' })
  })

  test('google error param redirects home without a session', async () => {
    const res = await app.request('/login?error=access_denied')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
  })

  test('POST /logout clears the session', async () => {
    const res = await app.request('/logout', { method: 'POST' })
    expect(res.status).toBe(303)
    expect(setCookies(res).some((c) => c.startsWith('session=;') || /session=; .*Max-Age=0/i.test(c))).toBe(true)
  })
})
