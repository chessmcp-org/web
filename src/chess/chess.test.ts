import { describe, expect, test } from 'bun:test'
import { START_FEN, parseFen, toFen } from './fen'
import { applyMove, isCheck, legalMoves } from './rules'
import { moveToSan, sanToMove, squareIndex, squareName } from './san'
import type { Position } from './types'

function perft(p: Position, depth: number): number {
  if (depth === 0) return 1
  let n = 0
  for (const m of legalMoves(p)) n += perft(applyMove(p, m), depth - 1)
  return n
}

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'

describe('fen', () => {
  test('start position round trips', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN)
  })
  test('kiwipete round trips', () => {
    expect(toFen(parseFen(KIWIPETE))).toBe(KIWIPETE)
  })
  test('garbage throws a readable error', () => {
    expect(() => parseFen('garbage')).toThrow(/FEN/)
  })
  test('squareName and squareIndex agree', () => {
    expect(squareIndex('a8')).toBe(0)
    expect(squareIndex('h1')).toBe(63)
    expect(squareName(squareIndex('e4'))).toBe('e4')
  })
})

describe('perft', () => {
  const start = parseFen(START_FEN)
  test('start depth 1', () => expect(perft(start, 1)).toBe(20))
  test('start depth 2', () => expect(perft(start, 2)).toBe(400))
  test('start depth 3', () => expect(perft(start, 3)).toBe(8902))
  const kiwi = parseFen(KIWIPETE)
  test('kiwipete depth 1', () => expect(perft(kiwi, 1)).toBe(48))
  test('kiwipete depth 2', () => expect(perft(kiwi, 2)).toBe(2039))
})

describe('san', () => {
  test('disambiguation by file: Nbd2', () => {
    const p = parseFen('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1')
    const m = sanToMove(p, 'Nbd2')
    expect(squareName(m.from)).toBe('b1')
    expect(moveToSan(p, m)).toBe('Nbd2')
  })
  test('disambiguation by rank: R1a3', () => {
    const p = parseFen('4k3/8/8/8/R7/8/8/R3K3 w - - 0 1')
    const m = sanToMove(p, 'R1a3')
    expect(squareName(m.from)).toBe('a1')
    expect(moveToSan(p, m)).toBe('R1a3')
  })
  test('en passant exd6', () => {
    const p = parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const m = sanToMove(p, 'exd6')
    expect(moveToSan(p, m)).toBe('exd6')
    const after = applyMove(p, m)
    expect(after.board[squareIndex('d5')]).toBeNull()
    expect(after.board[squareIndex('d6')]).toEqual({ color: 'w', type: 'p' })
  })
  test('promotion with check e8=Q+', () => {
    const p = parseFen('7k/4P3/8/8/8/8/8/4K3 w - - 0 1')
    const m = sanToMove(p, 'e8=Q+')
    expect(m.promotion).toBe('q')
    expect(moveToSan(p, m)).toBe('e8=Q+')
  })
  test('castling both sides, and 0-0 / annotations accepted', () => {
    const p = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(moveToSan(p, sanToMove(p, 'O-O'))).toBe('O-O')
    expect(moveToSan(p, sanToMove(p, 'O-O-O'))).toBe('O-O-O')
    expect(sanToMove(p, '0-0')).toEqual(sanToMove(p, 'O-O'))
    expect(sanToMove(p, 'Kd2!?')).toEqual(sanToMove(p, 'Kd2'))
  })
  test('checkmate gets #', () => {
    const p = parseFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    expect(moveToSan(p, sanToMove(p, 'Ra8'))).toBe('Ra8#')
    expect(isCheck(applyMove(p, sanToMove(p, 'Ra8')))).toBe(true)
  })
  test('illegal move throws naming the move', () => {
    expect(() => sanToMove(parseFen(START_FEN), 'Ke3')).toThrow(/Ke3/)
  })
  test('ambiguous move throws', () => {
    const p = parseFen('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1')
    expect(() => sanToMove(p, 'Nd2')).toThrow(/ambiguous/i)
  })
})
