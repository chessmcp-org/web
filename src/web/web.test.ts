import { describe, expect, test } from 'bun:test'
import { makeSessionCookie } from '../auth/session'
import { makeMcpToken } from '../auth/token'
import { webRoutes } from './routes'

const SECRET = 'web-test-secret'
const BASE = 'https://chessmcp.org'
const app = webRoutes({ secret: SECRET, baseUrl: BASE })
const cookie = (sub: string, email: string) => ({ headers: { cookie: `session=${makeSessionCookie({ sub, email }, SECRET)}` } })

describe('home', () => {
  test('explains the product, shows a sample board and a Google sign-in', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Sign in with Google')
    expect(html).toContain('href="/login"')
    expect(html).toContain('<svg')
    expect(html).toContain('ChatGPT')
    expect(html).toContain('CC BY-NC-SA 4.0')
  })
  test('signed-in visitors get a dashboard link instead of the sign-in button', async () => {
    const html = await (await app.request('/', cookie('1', 'a@b.c'))).text()
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain('Sign in with Google')
  })
})

describe('dashboard', () => {
  test('without a session redirects home', async () => {
    const res = await app.request('/dashboard')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
  })
  test('with a tampered session redirects home', async () => {
    const res = await app.request('/dashboard', { headers: { cookie: 'session=abc.def' } })
    expect(res.status).toBe(302)
  })
  test('shows only the signed-in user their own MCP URL', async () => {
    const mine = makeMcpToken('user-A', SECRET)
    const theirs = makeMcpToken('user-B', SECRET)
    const html = await (await app.request('/dashboard', cookie('user-A', 'a@example.com'))).text()
    expect(html).toContain(`${BASE}/mcp/${mine}`)
    expect(html).not.toContain(theirs)
    expect(html).toContain('a@example.com')
    expect(html).toContain('action="/logout"')
  })
  test('escapes the email', async () => {
    const html = await (await app.request('/dashboard', cookie('u', '<script>alert(1)</script>@x.io'))).text()
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('misc', () => {
  test('/healthz is ok', async () => {
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
  test('/preview exists only in dev', async () => {
    expect((await app.request('/preview?pgn=1.+e4+e5')).status).toBe(404)
    const dev = webRoutes({ secret: SECRET, baseUrl: 'http://localhost:3000' })
    const res = await dev.request('/preview?pgn=1.+e4+e5')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<!doctype html>')
    expect((await dev.request('/preview?pgn=1.+e4+e5+Qh6')).status).toBe(400)
  })
})
