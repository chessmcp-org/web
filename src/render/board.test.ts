import { describe, expect, test } from 'bun:test'
import { START_FEN, parseFen } from '../chess/fen'
import { squareIndex } from '../chess/san'
import { renderBoardSvg } from './board'
import { escapeXml } from './escape'

/** Minimal well-formedness check: tags balance and nothing is left open. */
function assertBalanced(xml: string) {
  const stack: string[] = []
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = m
    if (selfClosing) continue
    if (closing) expect(stack.pop()).toBe(name)
    else stack.push(name!)
  }
  expect(stack).toEqual([])
}

const count = (s: string, re: RegExp) => [...s.matchAll(re)].length
const start = parseFen(START_FEN)

describe('renderBoardSvg', () => {
  test('start position has 64 squares and 32 pieces and is balanced', () => {
    const svg = renderBoardSvg(start)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(count(svg, /class="sq /g)).toBe(64)
    expect(count(svg, /<use /g)).toBe(32)
    assertBalanced(svg)
  })
  test('flipped board reverses the file labels', () => {
    const labels = (svg: string) => [...svg.matchAll(/class="file"[^>]*>([a-h])</g)].map((m) => m[1]).join('')
    expect(labels(renderBoardSvg(start))).toBe('abcdefgh')
    expect(labels(renderBoardSvg(start, { flipped: true }))).toBe('hgfedcba')
  })
  test('lastMove highlights exactly two squares', () => {
    const svg = renderBoardSvg(start, { lastMove: { from: squareIndex('e2'), to: squareIndex('e4') } })
    expect(count(svg, /class="hl"/g)).toBe(2)
    expect(count(renderBoardSvg(start), /class="hl"/g)).toBe(0)
  })
  test('defs: false omits piece symbols', () => {
    expect(renderBoardSvg(start, { defs: false })).not.toContain('<symbol')
    expect(renderBoardSvg(start)).toContain('<symbol')
  })
})

describe('escapeXml', () => {
  test('escapes markup characters', () => {
    const out = escapeXml(`<script>"&'`)
    expect(out).not.toMatch(/[<>"']/)
    expect(out).toContain('&amp;')
  })
})
