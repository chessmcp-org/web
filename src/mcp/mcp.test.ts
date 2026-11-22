import { describe, expect, test } from 'bun:test'
import { makeMcpToken } from '../auth/token'
import { mcpRoutes } from './server'

const SECRET = 'mcp-test-secret'
const app = mcpRoutes({ secret: SECRET, baseUrl: 'https://chessmcp.org' })
const token = makeMcpToken('user-1', SECRET)

async function rpc(method: string, params?: unknown, id: number | null = 1, tok = token) {
  const body: Record<string, unknown> = { jsonrpc: '2.0', method, params }
  if (id !== null) body.id = id
  return app.request(`/mcp/${tok}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
const result = async (res: Response) => (await res.json()).result
const PGN = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0'

describe('auth and transport', () => {
  test('invalid token → 401, valid → 200', async () => {
    expect((await rpc('ping', undefined, 1, 'bad.token')).status).toBe(401)
    expect((await rpc('ping', undefined, 1, makeMcpToken('x', 'other-secret'))).status).toBe(401)
    expect((await rpc('ping')).status).toBe(200)
  })
  test('GET → 405', async () => {
    expect((await app.request(`/mcp/${token}`)).status).toBe(405)
  })
  test('notifications get 202 with no body', async () => {
    const res = await rpc('notifications/initialized', undefined, null)
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
  })
  test('unknown method → -32601; malformed JSON → -32700', async () => {
    expect((await (await rpc('nope')).json()).error.code).toBe(-32601)
    const bad = await app.request(`/mcp/${token}`, { method: 'POST', body: '{not json' })
    expect((await bad.json()).error.code).toBe(-32700)
  })
})

describe('initialize and listings', () => {
  test('initialize advertises tools and resources', async () => {
    const r = await result(await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }))
    expect(r.protocolVersion).toBe('2025-06-18')
    expect(r.capabilities.tools).toBeDefined()
    expect(r.capabilities.resources).toBeDefined()
    expect(r.serverInfo.name).toBe('chessmcp')
    expect(r.serverInfo.icons[0]).toEqual({ src: 'https://chessmcp.org/logo-512.png', mimeType: 'image/png', sizes: ['512x512'] })
  })
  test('tools/list has exactly show_lesson, linked to the widget', async () => {
    const { tools } = await result(await rpc('tools/list'))
    expect(tools.map((t: any) => t.name)).toEqual(['show_lesson'])
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object')
      expect(t._meta.ui.resourceUri).toBe('ui://widget/chessmcp-v2.html')
      expect(t._meta['openai/outputTemplate']).toBe('ui://widget/chessmcp-v2.html')
      expect(t.annotations.readOnlyHint).toBe(true)
    }
    expect(tools[0].inputSchema.required).toEqual(['moves'])
    expect(Object.keys(tools[0].inputSchema.properties).sort()).toEqual(['fen', 'moves', 'seconds_per_move', 'title'])
  })
  test('resources/list and resources/read serve the widget html', async () => {
    const { resources } = await result(await rpc('resources/list'))
    expect(resources[0]).toMatchObject({ uri: 'ui://widget/chessmcp-v2.html', mimeType: 'text/html;profile=mcp-app' })
    const { contents } = await result(await rpc('resources/read', { uri: 'ui://widget/chessmcp-v2.html' }))
    expect(contents[0].mimeType).toBe('text/html;profile=mcp-app')
    expect(contents[0].text.startsWith('<!doctype html>')).toBe(true)
    expect((await (await rpc('resources/read', { uri: 'ui://nope' })).json()).error).toBeDefined()
  })
})

describe('show_lesson', () => {
  const call = async (args: unknown, name = 'show_lesson') => result(await rpc('tools/call', { name, arguments: args }))
  const KR = '6k1/8/8/8/8/8/4K3/R7 w - - 0 1'
  const MATE_IN_1 = '7k/8/6K1/8/8/8/8/R7 w - - 0 1'

  test('plays a line from the standard start: small structuredContent, game in _meta, move list in the text', async () => {
    const r = await call({ moves: '1. e4 e5 2. Nf3' })
    expect(r.isError).toBeFalsy()
    expect(r.structuredContent.plyCount).toBe(3)
    expect(r.structuredContent.plies).toBeUndefined()
    expect(JSON.stringify(r.structuredContent).length).toBeLessThan(300)
    expect(r._meta.game.plies.map((p: any) => p.san)).toEqual(['e4', 'e5', 'Nf3'])
    expect(r._meta.game.delayMs).toBe(1500)
    expect(r.content[0].text).toContain('1. e4 e5 2. Nf3')
  })
  test('starts from a custom fen, carries the title, and keeps comments as captions', async () => {
    const r = await call({ fen: KR, title: 'Rook mate', moves: 'Ra7 {cuts off the king} Kf8 Kf3' })
    expect(r._meta.game.startFen).toBe(KR)
    expect(r._meta.game.title).toBe('Rook mate')
    expect(r._meta.game.plies[0].comment).toBe('cuts off the king')
    expect(r.content[0].text).toContain('Rook mate')
  })
  test('reports the final position: checkmate, ongoing, stalemate', async () => {
    const mate = await call({ fen: MATE_IN_1, moves: 'Ra8#' })
    expect(mate.content[0].text).toMatch(/Final position: checkmate\. White wins/)
    const ongoing = await call({ fen: KR, moves: 'Ra7 Kf8' })
    expect(ongoing.content[0].text).toMatch(/Final position: not checkmate; White to move/)
    const stale = await call({ fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', moves: 'Qf7' })
    expect(stale.content[0].text).toMatch(/Final position: stalemate/)
  })
  test('warns when the title promises mate but the line does not end in mate', async () => {
    const r = await call({ fen: KR, title: 'King and rook checkmate', moves: 'Ra7 Kf8' })
    expect(r.content[0].text).toMatch(/WARNING: .*checkmate/i)
    const ok = await call({ fen: MATE_IN_1, title: 'King and rook checkmate', moves: 'Ra8#' })
    expect(ok.content[0].text).not.toMatch(/WARNING/)
  })
  test('warns when an endgame lesson starts from the standard position', async () => {
    const r = await call({ title: 'Rook endgame', moves: '1. e4 e5' })
    expect(r.content[0].text).toMatch(/WARNING: .*fen/i)
  })
  test('accepts a full PGN with headers as moves', async () => {
    const r = await call({ moves: '[White "A"]\n[Black "B"]\n\n1. e4 e5' })
    expect(r._meta.game.plies.length).toBe(2)
    expect(r._meta.game.headers.White).toBe('A')
  })
  test('seconds_per_move sets the delay, clamped to 0.3-10 s, default 1.5 s', async () => {
    const delay = async (v: unknown) => (await call({ moves: '1. e4', seconds_per_move: v }))._meta.game.delayMs
    expect(await delay(2)).toBe(2000)
    expect(await delay(0)).toBe(300)
    expect(await delay(99)).toBe(10000)
    expect(await delay('fast')).toBe(1500)
  })
  test('illegal move → isError naming the move', async () => {
    const r = await call({ fen: KR, moves: 'Ra7 Ke5' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/Ke5/)
    expect(r.content[0].text).toMatch(/Legal moves:/)
    expect(r.content[0].text).toMatch(/retry|again|correct/i)
  })
  test('empty, missing or non-string arguments → isError', async () => {
    expect((await call({ moves: '   ' })).isError).toBe(true)
    expect((await call({})).isError).toBe(true)
    expect((await call({ moves: 42 })).isError).toBe(true)
    expect((await call({ moves: '1. e4', fen: 5 })).isError).toBe(true)
    expect((await call({ moves: '1. e4', title: {} })).isError).toBe(true)
    expect((await call({ moves: '1. e4', fen: 'nope' })).isError).toBe(true)
  })
  test('a hostile fen cannot inject PGN headers', async () => {
    expect((await call({ fen: KR + '"]\n[White "x', moves: 'Ra7' })).isError).toBe(true)
  })
  test('oversized moves and games over the ply cap → isError', async () => {
    expect((await call({ moves: '1. e4 '.repeat(40_000) })).isError).toBe(true)
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8']
    const r = await call({ moves: Array.from({ length: 2001 }, (_, i) => cycle[i % 4]).join(' ') })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/2000/)
  })
  test('the old tools are gone', async () => {
    expect((await call({ pgn: '1. e4' }, 'show_game')).isError).toBe(true)
    expect((await call({ fen: KR }, 'show_position')).isError).toBe(true)
  })
  test('description and instructions push the model toward commented, step-by-step lessons', async () => {
    const { tools } = await result(await rpc('tools/list'))
    expect(tools[0].description).toMatch(/comment/i)
    expect(tools[0].description).toMatch(/auto/i)
    const init = await result(await rpc('initialize', { protocolVersion: '2025-06-18' }))
    expect(init.instructions).toMatch(/show_lesson/)
    expect(init.instructions).toMatch(/lesson|example|how to/i)
  })
})

describe('request limits', () => {
  test('a body over 256 KB is rejected with 413', async () => {
    const res = await app.request(`/mcp/${token}`, { method: 'POST', body: 'x'.repeat(300_000) })
    expect(res.status).toBe(413)
  })
  test('batches are rejected as invalid requests, including the empty batch', async () => {
    const post = (body: unknown) =>
      app.request(`/mcp/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    for (const b of [[], [{ jsonrpc: '2.0', id: 1, method: 'ping' }]]) {
      expect((await (await post(b)).json()).error.code).toBe(-32600)
    }
  })
})

describe('diagnostics', () => {
  test('a rejected lesson is logged as one short line without the full position or moves', async () => {
    const lines: string[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => void lines.push(a.join(' '))
    try {
      await rpc('tools/call', { name: 'show_lesson', arguments: { fen: '6k1/8/8/8/8/8/4K3/R7 w - - 0 1', moves: 'Ra7 Ke5' } })
    } finally {
      console.error = orig
    }
    expect(lines.length).toBe(1)
    expect(lines[0]).toMatch(/tool error/i)
    expect(lines[0]).toMatch(/Ke5/)
    expect(lines[0]).not.toMatch(/Legal moves|6k1\/8/)
  })
})
