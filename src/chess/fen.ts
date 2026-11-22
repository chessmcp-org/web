import { isAttacked } from './rules'
import type { Piece, PieceType, Position } from './types'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const FILES = 'abcdefgh'

export function squareName(i: number): string {
  return FILES[i % 8]! + (8 - Math.floor(i / 8))
}

export function squareIndex(name: string): number {
  const f = FILES.indexOf(name[0] ?? '')
  const r = Number(name[1])
  if (f < 0 || !(r >= 1 && r <= 8) || name.length !== 2) throw new Error(`Invalid square "${name}"`)
  return (8 - r) * 8 + f
}

export function parseFen(fen: string): Position {
  const bad = (why: string) => new Error(`Invalid FEN (${why}): "${fen}"`)
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 4) throw bad('expected at least 4 fields')
  const [placement, turn, castling, ep, half = '0', full = '1'] = parts as [string, string, string, string, string?, string?]
  const rows = placement.split('/')
  if (rows.length !== 8) throw bad('expected 8 ranks')
  const board: (Piece | null)[] = []
  for (const row of rows) {
    let count = 0
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) board.push(null)
        count += Number(ch)
      } else if (/[pnbrqkPNBRQK]/.test(ch)) {
        board.push({ color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase() as PieceType })
        count++
      } else throw bad(`bad piece "${ch}"`)
    }
    if (count !== 8) throw bad('rank does not have 8 squares')
  }
  if (turn !== 'w' && turn !== 'b') throw bad('side to move must be w or b')
  if (!/^(-|[KQkq]+)$/.test(castling)) throw bad('bad castling field')
  const kingAt = (c: string) => board.findIndex((p) => p?.type === 'k' && p.color === c)
  const kings = (c: string) => board.filter((p) => p?.type === 'k' && p.color === c).length
  if (kings('w') !== 1 || kings('b') !== 1) throw bad('each side needs exactly one king')
  if ([...board.slice(0, 8), ...board.slice(56)].some((p) => p?.type === 'p')) throw bad('pawn on the first or last rank')
  const [wk, bk] = [kingAt('w'), kingAt('b')]
  if (Math.abs((wk % 8) - (bk % 8)) <= 1 && Math.abs(Math.floor(wk / 8) - Math.floor(bk / 8)) <= 1) throw bad('kings are adjacent')
  const pos: Position = {
    board,
    turn,
    castling,
    ep: ep === '-' ? null : squareIndex(ep),
    halfmove: Number(half) || 0,
    fullmove: Number(full) || 1,
  }
  if (isAttacked(pos, kingAt(turn === 'w' ? 'b' : 'w'), turn)) throw bad('the side not to move is in check')
  pos.ep = sanitizeEp(pos)
  return pos
}

/** Keep an en-passant square only if a double pawn push could really have just happened. */
function sanitizeEp(p: Position): number | null {
  if (p.ep === null) return null
  const white = p.turn === 'w'
  if (Math.floor(p.ep / 8) !== (white ? 2 : 5)) return null
  const pawn = p.board[white ? p.ep + 8 : p.ep - 8]
  const origin = p.board[white ? p.ep - 8 : p.ep + 8]
  const ok = !p.board[p.ep] && !origin && pawn?.type === 'p' && pawn.color === (white ? 'b' : 'w')
  return ok ? p.ep : null
}

export function toFen(p: Position): string {
  const rows: string[] = []
  for (let r = 0; r < 8; r++) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const piece = p.board[r * 8 + f]
      if (!piece) empty++
      else {
        if (empty) row += empty
        empty = 0
        row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type
      }
    }
    if (empty) row += empty
    rows.push(row)
  }
  return `${rows.join('/')} ${p.turn} ${p.castling} ${p.ep === null ? '-' : squareName(p.ep)} ${p.halfmove} ${p.fullmove}`
}
