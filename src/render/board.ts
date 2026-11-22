import type { Move, Position } from '../chess/types'
import { PIECE_SYMBOLS } from './pieces'

export type BoardOptions = {
  flipped?: boolean
  lastMove?: Move
  /** Include the shared piece <symbol> defs (default true). The widget includes them once itself. */
  defs?: boolean
}

export const SQUARE = 90
export const MARGIN = 40
export const LIGHT = '#eeeed2'
export const DARK = '#769656'

/** Top-left pixel of the square at board index `i` (0 = a8). */
export function squareXY(i: number, flipped = false): [number, number] {
  const col = i % 8
  const row = Math.floor(i / 8)
  return [MARGIN + (flipped ? 7 - col : col) * SQUARE, MARGIN + (flipped ? 7 - row : row) * SQUARE]
}

export function renderBoardSvg(p: Position, opts: BoardOptions = {}): string {
  const flipped = !!opts.flipped
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Chess board">`)
  if (opts.defs !== false) out.push(`<defs>${PIECE_SYMBOLS}</defs>`)
  out.push(`<rect width="800" height="800" fill="#312e2b"/>`)
  for (let i = 0; i < 64; i++) {
    const [x, y] = squareXY(i, flipped)
    const light = (Math.floor(i / 8) + (i % 8)) % 2 === 0
    out.push(`<rect class="sq ${light ? 'l' : 'd'}" x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}" fill="${light ? LIGHT : DARK}"/>`)
  }
  if (opts.lastMove) {
    for (const sq of [opts.lastMove.from, opts.lastMove.to]) {
      const [x, y] = squareXY(sq, flipped)
      out.push(`<rect class="hl" x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}" fill="#f6e84a" fill-opacity="0.5"/>`)
    }
  }
  for (let c = 0; c < 8; c++) {
    const file = 'abcdefgh'[flipped ? 7 - c : c]
    out.push(`<text class="file" x="${MARGIN + c * SQUARE + SQUARE / 2}" y="${MARGIN + 8 * SQUARE + 26}" text-anchor="middle" font-size="22" font-family="sans-serif" fill="#bababa">${file}</text>`)
  }
  for (let r = 0; r < 8; r++) {
    const rank = flipped ? r + 1 : 8 - r
    out.push(`<text class="rank" x="${MARGIN / 2}" y="${MARGIN + r * SQUARE + SQUARE / 2 + 8}" text-anchor="middle" font-size="22" font-family="sans-serif" fill="#bababa">${rank}</text>`)
  }
  for (let i = 0; i < 64; i++) {
    const piece = p.board[i]
    if (!piece) continue
    const [x, y] = squareXY(i, flipped)
    out.push(`<use href="#${piece.color}${piece.type.toUpperCase()}" x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}"/>`)
  }
  out.push('</svg>')
  return out.join('')
}
