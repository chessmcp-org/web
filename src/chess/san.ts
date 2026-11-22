import { squareIndex, squareName } from './fen'
import { applyMove, isCheck, legalMoves } from './rules'
import type { Move, PieceType, Position } from './types'

export { squareIndex, squareName }

const LETTER: Record<PieceType, string> = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }

export function moveToSan(p: Position, m: Move): string {
  const piece = p.board[m.from]!
  let san: string
  if (piece.type === 'k' && Math.abs(m.to - m.from) === 2) {
    san = m.to > m.from ? 'O-O' : 'O-O-O'
  } else {
    const capture = !!p.board[m.to] || (piece.type === 'p' && m.from % 8 !== m.to % 8)
    san = LETTER[piece.type]
    if (piece.type === 'p') {
      if (capture) san += squareName(m.from)[0]
    } else {
      const rivals = legalMoves(p).filter((o) => o.to === m.to && o.from !== m.from && p.board[o.from]?.type === piece.type)
      if (rivals.length) {
        const sameFile = rivals.some((o) => o.from % 8 === m.from % 8)
        const sameRank = rivals.some((o) => Math.floor(o.from / 8) === Math.floor(m.from / 8))
        if (!sameFile) san += squareName(m.from)[0]
        else if (!sameRank) san += squareName(m.from)[1]
        else san += squareName(m.from)
      }
    }
    if (capture) san += 'x'
    san += squareName(m.to)
    if (m.promotion) san += '=' + LETTER[m.promotion]
  }
  const next = applyMove(p, m)
  if (isCheck(next)) san += legalMoves(next).length === 0 ? '#' : '+'
  return san
}

const MAX_SAN_CHARS = 16

/** Parse a SAN move (tolerates 0-0, x/+/#/!? decorations, lowercase promotion) in the given position. */
export function sanToMove(p: Position, san: string): Move {
  const unrecognized = () => new Error(`Unrecognized notation "${san.length > 20 ? san.slice(0, 20) + '…' : san}"`)
  if (san.length > MAX_SAN_CHARS) throw unrecognized()
  let end = san.length
  while (end > 0 && '+#!?'.includes(san[end - 1]!)) end--
  const clean = san.slice(0, end).replace(/0/g, 'O')
  const legal = legalMoves(p)
  if (clean === 'O-O' || clean === 'O-O-O') {
    const home = p.turn === 'w' ? 60 : 4
    const to = clean === 'O-O' ? home + 2 : home - 2
    const m = legal.find((x) => x.from === home && x.to === to && p.board[x.from]?.type === 'k')
    if (!m) throw new Error(`Illegal move ${san}`)
    return m
  }
  const match = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQnbrq]))?$/.exec(clean)
  if (!match) throw unrecognized()
  const [, pieceCh, fileCh, rankCh, dest, promoCh] = match
  const type = (pieceCh ? pieceCh.toLowerCase() : 'p') as PieceType
  const to = squareIndex(dest!)
  const cands = legal.filter((m) => {
    if (m.to !== to || p.board[m.from]?.type !== type) return false
    if (fileCh && squareName(m.from)[0] !== fileCh) return false
    if (rankCh && squareName(m.from)[1] !== rankCh) return false
    if ((m.promotion ?? '') !== (promoCh ? promoCh.toLowerCase() : '')) return false
    return true
  })
  if (cands.length === 0) throw new Error(`Illegal move ${san}`)
  if (cands.length > 1) throw new Error(`Ambiguous move ${san}`)
  return cands[0]!
}
