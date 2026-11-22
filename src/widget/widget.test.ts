import { describe, expect, test } from 'bun:test'
import { parseGame } from '../chess/pgn'
import { renderWidgetHtml } from './player'

const SHORT = `[White "Alice"]\n[Black "Bob"]\n[Event "Casual"]\n\n1. e4 e5 2. Nf3 Nc6 *`
const embedded = (html: string) => {
  const m = /<script type="application\/json" id="game-data">([\s\S]*?)<\/script>/.exec(html)
  expect(m).not.toBeNull()
  return JSON.parse(m![1]!)
}

describe('renderWidgetHtml', () => {
  test('is a full document with no network references besides the svg namespace', () => {
    const html = renderWidgetHtml(parseGame(SHORT))
    expect(html.startsWith('<!doctype html>')).toBe(true)
    const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0])
    expect(urls.filter((u) => u !== 'http://www.w3.org/2000/svg')).toEqual([])
  })
  test('embeds startFen plus one entry per ply', () => {
    const data = embedded(renderWidgetHtml(parseGame(SHORT)))
    expect(data.plies.length).toBe(4)
    expect(data.startFen).toContain('rnbqkbnr')
    expect(data.plies[0]).toMatchObject({ san: 'e4', number: 1, color: 'w' })
    expect(typeof data.plies[0].from).toBe('number')
  })
  test('hostile header text is escaped in html and in embedded json', () => {
    const evil = `<script>alert(1)</script>"</script><!--`
    const html = renderWidgetHtml(parseGame(`[White "${evil.replace(/"/g, '\\"')}"]\n\n1. e4 e5`))
    expect(html).not.toContain('<script>alert')
    expect(html.match(/<script/g)!.length).toBe(2) // data + client only
    expect(html).not.toContain('<!--')
    expect(embedded(html).headers.White).toBe(evil)
  })
  test('a 500-ply game stays under 300 KB', () => {
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8']
    const g = parseGame(Array.from({ length: 500 }, (_, i) => cycle[i % 4]).join(' '))
    expect(renderWidgetHtml(g).length).toBeLessThan(300_000)
  })
  test('a comment containing </script> cannot break out', () => {
    const html = renderWidgetHtml(parseGame('1. e4 {x</script><img src=x onerror=alert(1)>} e5'))
    expect(html.match(/<\/script>/g)!.length).toBe(2)
    expect(html).not.toContain('<img')
  })
})
