import { config } from '../config'
import { sign, verify } from './sign'

export const SESSION_COOKIE = 'session'
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000

export type SessionUser = { sub: string; email: string }

/** Signed cookie *value* (set it with HttpOnly/Secure/SameSite=Lax). */
export function makeSessionCookie(user: SessionUser, secret = config.sessionSecret, ttlMs = SESSION_TTL_MS): string {
  const payload = Buffer.from(JSON.stringify({ sub: user.sub, email: user.email, exp: Date.now() + ttlMs })).toString('base64url')
  return sign(payload, secret)
}

export function readSession(cookieHeader: string | undefined, secret = config.sessionSecret): SessionUser | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    const payload = verify(part.slice(eq + 1).trim(), secret)
    if (!payload) return null
    try {
      const d = JSON.parse(Buffer.from(payload, 'base64url').toString())
      if (typeof d.sub !== 'string' || typeof d.email !== 'string' || typeof d.exp !== 'number' || d.exp < Date.now()) return null
      return { sub: d.sub, email: d.email }
    } catch {
      return null
    }
  }
  return null
}
