import { START_FEN, parseFen, toFen } from './fen'
import { type Game, type Ply, gameFromFen } from './game'
import { applyMove } from './rules'
import { moveToSan, sanToMove } from './san'

export { gameFromFen }

export class PgnError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PgnError'
  }
}

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

/** Parse the first game of a PGN text. Mainline only; comments are kept, variations and NAGs dropped. */
export function parseGame(pgn: string): Game {
  const text = pgn.replace(/^\uFEFF/, '').replace(/\r/g, '')
  if (!text.trim()) throw new PgnError('PGN is empty')

  const headers: Record<string, string> = {}
  let i = 0
  const tag = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/
  for (let m = tag.exec(text.slice(i)); m; m = tag.exec(text.slice(i))) {
    headers[m[1]!] = m[2]!.replace(/\\(["\\])/g, '$1')
    i += m[0].length
  }

  let startFen = START_FEN
  let pos
  try {
    if (headers.FEN) startFen = toFen((pos = parseFen(headers.FEN)))
    else pos = parseFen(START_FEN)
  } catch (e) {
    throw new PgnError(`Bad FEN header: ${(e as Error).message}`)
  }

  const plies: Ply[] = []
  let result: string | undefined
  const n = text.length

  scan: while (i < n) {
    const ch = text[i]!
    if (/\s/.test(ch)) {
      i++
    } else if (ch === '{') {
      const end = text.indexOf('}', i)
      const body = text.slice(i + 1, end < 0 ? n : end).trim()
      const last = plies[plies.length - 1]
      if (last && body) last.comment = last.comment ? `${last.comment} ${body}` : body
      i = end < 0 ? n : end + 1
    } else if (ch === ';') {
      const end = text.indexOf('\n', i)
      i = end < 0 ? n : end + 1
    } else if (ch === '(') {
      let depth = 0
      while (i < n) {
        const c = text[i]!
        if (c === '{') {
          const end = text.indexOf('}', i)
          i = end < 0 ? n : end + 1
          continue
        }
        if (c === '(') depth++
        else if (c === ')' && --depth === 0) {
          i++
          break
        }
        i++
      }
    } else if (ch === '[' && (i === 0 || text[i - 1] === '\n')) {
      break // next game's headers
    } else if (ch === '$') {
      while (i < n && !/\s/.test(text[i]!)) i++
    } else {
      let j = i
      while (j < n && !/[\s{(;]/.test(text[j]!)) j++
      const token = text.slice(i, j)
      i = j
      if (RESULTS.has(token)) {
        result = token
        break scan
      }
      const san = token.replace(/^\d+\.+/, '')
      if (!san) continue
      let move
      try {
        move = sanToMove(pos, san)
      } catch (e) {
        throw new PgnError(`Move ${pos.fullmove}${pos.turn === 'b' ? '...' : ''} (${san}): ${(e as Error).message}`)
      }
      const number = pos.fullmove
      const color = pos.turn
      const canonical = moveToSan(pos, move)
      pos = applyMove(pos, move)
      plies.push({ san: canonical, move, fen: toFen(pos), number, color })
    }
  }

  result ??= headers.Result && RESULTS.has(headers.Result) ? headers.Result : undefined
  if (plies.length === 0 && !headers.FEN) throw new PgnError('PGN contains no moves')
  return { headers, startFen, plies, result }
}
