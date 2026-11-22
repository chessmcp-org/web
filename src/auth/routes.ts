import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { type Config, config as defaultConfig } from '../config'
import { exchangeCode as defaultExchange, googleAuthUrl } from './google'
import { SESSION_COOKIE, SESSION_TTL_MS, makeSessionCookie } from './session'
import { sign, verify } from './sign'

type Deps = {
  config?: Config
  exchangeCode?: (code: string) => Promise<{ sub: string; email: string }>
}

const STATE_COOKIE = 'oauth_state'

export function authRoutes(deps: Deps = {}) {
  const cfg = deps.config ?? defaultConfig
  const exchange = deps.exchangeCode ?? ((code: string) => defaultExchange(code, cfg))
  const secure = cfg.baseUrl.startsWith('https://')
  const cookieOpts = { httpOnly: true, secure, sameSite: 'Lax', path: '/' } as const
  const app = new Hono()

  app.get('/login', async (c) => {
    if (c.req.query('error')) return c.redirect('/')
    const code = c.req.query('code')
    if (!code) {
      const state = randomBytes(16).toString('hex')
      setCookie(c, STATE_COOKIE, sign(state, cfg.sessionSecret), { ...cookieOpts, maxAge: 600 })
      return c.redirect(googleAuthUrl(state, cfg))
    }
    const state = c.req.query('state')
    const raw = getCookie(c, STATE_COOKIE)
    const expected = raw ? verify(raw, cfg.sessionSecret) : null
    if (!state || !expected || state !== expected) return c.text('Invalid login state. Please try signing in again.', 400)
    deleteCookie(c, STATE_COOKIE, { path: '/', secure })
    let user
    try {
      user = await exchange(code)
    } catch (e) {
      console.error('login failed:', (e as Error).message)
      return c.text('Google sign-in failed. Please try again.', 502)
    }
    setCookie(c, SESSION_COOKIE, makeSessionCookie(user, cfg.sessionSecret), { ...cookieOpts, maxAge: SESSION_TTL_MS / 1000 })
    return c.redirect('/dashboard')
  })

  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure })
    return c.redirect('/', 303)
  })

  return app
}
