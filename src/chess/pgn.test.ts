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

describe('review fixes: hostile and noisy input', () => {
  test('a huge garbage token is rejected fast with a short message (no regex blowup)', () => {
    const t = performance.now()
    let message = ''
    try {
      parseGame('+'.repeat(100_000) + 'a')
    } catch (e) {
      message = (e as Error).message
    }
    expect(performance.now() - t).toBeLessThan(100)
    expect(message).toMatch(/Unrecognized notation/)
    expect(message.length).toBeLessThan(200)
  })
  test('more than 2000 half-moves is rejected with a clear error', () => {
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8']
    const moves = Array.from({ length: 2001 }, (_, i) => cycle[i % 4]).join(' ')
    expect(() => parseGame(moves)).toThrow(/2000/)
  })
  test('[%eval] and [%clk] commands are stripped from comments', () => {
    const g = parseGame('1. e4 { [%eval 0.17] [%clk 0:03:00] } e5 { Solid [%clk 0:02:59] }')
    expect(g.plies[0]!.comment).toBeUndefined()
    expect(g.plies[1]!.comment).toBe('Solid')
  })
  test('tolerates "...", lone glyphs, e.p., lowercase promotion and the unicode half result', () => {
    expect(parseGame('1. e4 e5 2. Nf3 ... Nc6').plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
    expect(parseGame('1. e4 !? e5 ?! 2. Nf3 !!').plies.length).toBe(3)
    const ep = parseGame('[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"]\n\n1. exd6 e.p. Kd7')
    expect(ep.plies.map((p) => p.san)).toEqual(['exd6', 'Kd7'])
    const promo = parseGame('[FEN "7k/4P3/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. e8=q+')
    expect(promo.plies[0]!.san).toBe('e8=Q+')
    expect(parseGame('1. e4 e5 \u00bd-\u00bd').result).toBe('1/2-1/2')
  })
  test('null moves give a clear unsupported error', () => {
    expect(() => parseGame('1. e4 -- 2. Nf3')).toThrow(/null move/i)
    expect(() => parseGame('1. e4 Z0 2. Nf3')).toThrow(/null move/i)
  })
  test('non-SAN junk says "Unrecognized notation", not "Illegal move"', () => {
    expect(() => parseGame('1. e4 banana')).toThrow(/Unrecognized notation/)
  })
})

describe('actionable move errors', () => {
  const message = (pgn: string) => {
    try {
      parseGame(pgn)
    } catch (e) {
      return (e as Error).message
    }
    return ''
  }
  test('an illegal move reports the position before it and the legal moves', () => {
    const m = message('1. e4 e5 2. Nf3 Nf3')
    expect(m).toMatch(/Move 2\.\.\. \(Nf3\)/)
    expect(m).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2')
    expect(m).toMatch(/Legal moves:.*\bNc6\b/)
    expect(m).not.toMatch(/Legal moves:.*\bNf3\b/)
  })
  test('an ambiguous move also lists the legal moves', () => {
    const m = message('[FEN "4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1"]\n\n1. Nd2')
    expect(m).toMatch(/Ambiguous/)
    expect(m).toMatch(/Legal moves:.*\bNbd2\b.*\bNfd2\b|Legal moves:.*\bNfd2\b.*\bNbd2\b/)
  })
})
