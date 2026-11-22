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

describe('logo', () => {
  test('/logo.svg and /favicon.svg serve the mark as svg', async () => {
    for (const path of ['/logo.svg', '/favicon.svg']) {
      const res = await app.request(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('image/svg+xml')
      expect((await res.text()).startsWith('<svg')).toBe(true)
    }
  })
  test('pages link the favicon and show the mark in the header', async () => {
    const html = await (await app.request('/')).text()
    expect(html).toContain('rel="icon"')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).toContain('class="mark"')
  })
})

describe('legal pages', () => {
  test('/privacy.txt is plain text and describes what is and is not stored', async () => {
    const res = await app.request('/privacy.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const t = await res.text()
    expect(t).toContain('Privacy Policy')
    expect(t).toContain('Google')
    expect(t).toMatch(/do not store/i)
    expect(t).toContain('cookie')
  })
  test('/terms.txt is plain text and covers the licence and the private link', async () => {
    const res = await app.request('/terms.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const t = await res.text()
    expect(t).toContain('Terms of Service')
    expect(t).toContain('CC BY-NC-SA 4.0')
    expect(t).toMatch(/private link/i)
  })
  test('pages link to both documents in the footer', async () => {
    const html = await (await app.request('/')).text()
    expect(html).toContain('href="/privacy.txt"')
    expect(html).toContain('href="/terms.txt"')
  })
})

describe('connector icon', () => {
  test('/logo-512.png serves a real 512px png', async () => {
    const res = await app.request('/logo-512.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(new DataView(bytes.buffer).getUint32(16)).toBe(512) // IHDR width
  })
})
