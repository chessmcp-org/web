import { config } from '../config'
import { hmac, safeEqual } from './sign'

/** `base64url(sub).base64url(HMAC(secret, "mcp:" + sub))`. The "mcp:" prefix keeps it distinct from session signatures. */
export function makeMcpToken(sub: string, secret = config.sessionSecret): string {
  return `${Buffer.from(sub).toString('base64url')}.${hmac(secret, 'mcp:' + sub)}`
}

export function verifyMcpToken(token: string, secret = config.sessionSecret): string | null {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const sub = Buffer.from(parts[0], 'base64url').toString()
  if (!sub || Buffer.from(sub).toString('base64url') !== parts[0]) return null
  return safeEqual(parts[1], hmac(secret, 'mcp:' + sub)) ? sub : null
}
