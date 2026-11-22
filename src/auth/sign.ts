import { createHmac, timingSafeEqual } from 'node:crypto'

export function hmac(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** `value.signature`. The value may itself contain dots; the signature is everything after the last one. */
export function sign(value: string, secret: string): string {
  return `${value}.${hmac(secret, value)}`
}

export function verify(signed: string, secret: string): string | null {
  const dot = signed.lastIndexOf('.')
  if (dot <= 0) return null
  const value = signed.slice(0, dot)
  return safeEqual(signed.slice(dot + 1), hmac(secret, value)) ? value : null
}
