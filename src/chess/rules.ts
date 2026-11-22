import type { Color, Move, Piece, PieceType, Position } from './types'

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]] as const
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] as const
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
/** [row, col] -> index, or -1 when off-board. Row 0 = rank 8. */
const at = (r: number, c: number) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c)

/** Is square `sq` attacked by any piece of color `by`? */
export function isAttacked(p: Position, sq: number, by: Color): boolean {
  const r = Math.floor(sq / 8)
  const c = sq % 8
  const is = (i: number, t: PieceType) => i >= 0 && p.board[i]?.color === by && p.board[i]?.type === t
  // Pawns: a white pawn attacks toward row-1, so it sits at row+1 relative to the target.
  const pr = by === 'w' ? r + 1 : r - 1
  if (is(at(pr, c - 1), 'p') || is(at(pr, c + 1), 'p')) return true
  for (const [dr, dc] of KNIGHT) if (is(at(r + dr, c + dc), 'n')) return true
  for (const [dr, dc] of KING) if (is(at(r + dr, c + dc), 'k')) return true
  const slide = (dirs: readonly (readonly [number, number])[], a: PieceType) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr
      let cc = c + dc
      while (at(rr, cc) >= 0) {
        const piece = p.board[at(rr, cc)]
        if (piece) {
          if (piece.color === by && (piece.type === a || piece.type === 'q')) return true
          break
        }
        rr += dr
        cc += dc
      }
    }
    return false
  }
  return slide(BISHOP, 'b') || slide(ROOK, 'r')
}

function kingSquare(p: Position, color: Color): number {
  return p.board.findIndex((x) => x?.type === 'k' && x.color === color)
}

export function isCheck(p: Position): boolean {
  return isAttacked(p, kingSquare(p, p.turn), other(p.turn))
}

function pseudoMoves(p: Position): Move[] {
  const moves: Move[] = []
  const us = p.turn
  const push = (from: number, to: number) => moves.push({ from, to })
  for (let from = 0; from < 64; from++) {
    const piece = p.board[from]
    if (!piece || piece.color !== us) continue
    const r = Math.floor(from / 8)
    const c = from % 8
    const free = (to: number) => to >= 0 && !p.board[to]
    const enemy = (to: number) => to >= 0 && p.board[to]?.color === other(us)
    if (piece.type === 'p') {
      const dir = us === 'w' ? -1 : 1
      const startRow = us === 'w' ? 6 : 1
      const lastRow = us === 'w' ? 0 : 7
      const addPawn = (to: number) => {
        if (Math.floor(to / 8) === lastRow) for (const promotion of ['q', 'r', 'b', 'n'] as const) moves.push({ from, to, promotion })
        else push(from, to)
      }
      const one = at(r + dir, c)
      if (free(one)) {
        addPawn(one)
        const two = at(r + 2 * dir, c)
        if (r === startRow && free(two)) push(from, two)
      }
      for (const dc of [-1, 1]) {
        const to = at(r + dir, c + dc)
        if (enemy(to)) addPawn(to)
        else if (to >= 0 && to === p.ep) push(from, to)
      }
    } else if (piece.type === 'n' || piece.type === 'k') {
      for (const [dr, dc] of piece.type === 'n' ? KNIGHT : KING) {
        const to = at(r + dr, c + dc)
        if (to >= 0 && p.board[to]?.color !== us) push(from, to)
      }
      if (piece.type === 'k') castlingMoves(p, from, moves)
    } else {
      const dirs = piece.type === 'b' ? BISHOP : piece.type === 'r' ? ROOK : [...BISHOP, ...ROOK]
      for (const [dr, dc] of dirs) {
        let rr = r + dr
        let cc = c + dc
        while (at(rr, cc) >= 0) {
          const to = at(rr, cc)
          const target = p.board[to]
          if (!target) push(from, to)
          else {
            if (target.color !== us) push(from, to)
            break
          }
          rr += dr
          cc += dc
        }
      }
    }
  }
  return moves
}

function castlingMoves(p: Position, from: number, out: Move[]) {
  const us = p.turn
  const home = us === 'w' ? 60 : 4
  if (from !== home) return
  const them = other(us)
  if (isAttacked(p, home, them)) return
  const rook = (sq: number) => p.board[sq]?.type === 'r' && p.board[sq]?.color === us
  const empty = (...sqs: number[]) => sqs.every((s) => !p.board[s])
  const safe = (...sqs: number[]) => sqs.every((s) => !isAttacked(p, s, them))
  const K = us === 'w' ? 'K' : 'k'
  const Q = us === 'w' ? 'Q' : 'q'
  if (p.castling.includes(K) && rook(home + 3) && empty(home + 1, home + 2) && safe(home + 1, home + 2)) out.push({ from, to: home + 2 })
  if (p.castling.includes(Q) && rook(home - 4) && empty(home - 1, home - 2, home - 3) && safe(home - 1, home - 2)) out.push({ from, to: home - 2 })
}

export function legalMoves(p: Position): Move[] {
  return pseudoMoves(p).filter((m) => {
    const next = applyMove(p, m)
    return !isAttacked(next, kingSquare(next, p.turn), other(p.turn))
  })
}

export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice()
  const piece = board[m.from] as Piece
  const us = p.turn
  const captured = board[m.to]
  board[m.to] = m.promotion ? { color: us, type: m.promotion } : piece
  board[m.from] = null
  let ep: number | null = null
  if (piece.type === 'p') {
    if (m.to === p.ep && !captured && m.from % 8 !== m.to % 8) board[us === 'w' ? m.to + 8 : m.to - 8] = null
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2
  }
  if (piece.type === 'k' && Math.abs(m.to - m.from) === 2) {
    const kingside = m.to > m.from
    const rookFrom = kingside ? m.to + 1 : m.to - 2
    const rookTo = kingside ? m.to - 1 : m.to + 1
    board[rookTo] = board[rookFrom] ?? null
    board[rookFrom] = null
  }
  let castling = p.castling === '-' ? '' : p.castling
  const strip = (chars: string) => (castling = castling.split('').filter((ch) => !chars.includes(ch)).join(''))
  if (piece.type === 'k') strip(us === 'w' ? 'KQ' : 'kq')
  for (const sq of [m.from, m.to]) {
    if (sq === 63) strip('K')
    if (sq === 56) strip('Q')
    if (sq === 7) strip('k')
    if (sq === 0) strip('q')
  }
  return {
    board,
    turn: other(us),
    castling: castling || '-',
    ep,
    halfmove: piece.type === 'p' || captured ? 0 : p.halfmove + 1,
    fullmove: us === 'b' ? p.fullmove + 1 : p.fullmove,
  }
}
