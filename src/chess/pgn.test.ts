import { describe, expect, test } from 'bun:test'
import { gameFromFen, parseGame, PgnError } from './pgn'

describe('parseGame', () => {
  test('ignores comments, NAGs, variations and keeps result and headers', () => {
    const pgn = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 {best by test} e5 $1 2. Nf3 (2. f4 exf4 3. Nf3) ; trailing line comment
2... Nc6 3. Bb5 a6 1-0`
    const g = parseGame(pgn)
    expect(g.headers.White).toBe('Alice')
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
    expect(g.result).toBe('1-0')
    expect(g.plies[0]!.comment).toBe('best by test')
    expect(g.plies[0]!.number).toBe(1)
    expect(g.plies[1]!.color).toBe('b')
  })
  test('annotation glyphs like !? are tolerated', () => {
    expect(parseGame('1. e4! e5?! 2. Nf3!!').plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3'])
  })
  test('uses [FEN] with [SetUp "1"] as the start position', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
    const g = parseGame(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. e4 Kd7`)
    expect(g.startFen).toBe(fen)
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'Kd7'])
    expect(g.plies[0]!.fen).toBe('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1')
  })
  test('illegal move throws PgnError naming the move number', () => {
    expect(() => parseGame('1. e4 e5 2. Nf3 Nf3')).toThrow(PgnError)
    expect(() => parseGame('1. e4 e5 2. Nf3 Nf3')).toThrow(/Move 2/)
  })
  test('empty or whitespace PGN throws', () => {
    expect(() => parseGame('')).toThrow(PgnError)
    expect(() => parseGame('  \n ')).toThrow(PgnError)
  })
  test('multi-game PGN returns the first game only', () => {
    const g = parseGame('[Event "A"]\n\n1. e4 e5 1-0\n\n[Event "B"]\n\n1. d4 d5 0-1')
    expect(g.headers.Event).toBe('A')
    expect(g.plies.map((p) => p.san)).toEqual(['e4', 'e5'])
  })
  test('500-ply game parses quickly', () => {
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8']
    const moves = Array.from({ length: 500 }, (_, i) => cycle[i % 4]).join(' ')
    const t = performance.now()
    const g = parseGame(moves)
    expect(g.plies.length).toBe(500)
    expect(performance.now() - t).toBeLessThan(500)
  })
  test('gameFromFen has zero plies', () => {
    const g = gameFromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')
    expect(g.plies.length).toBe(0)
    expect(g.startFen).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')
  })
})
