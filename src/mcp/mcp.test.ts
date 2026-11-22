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
  test('tools/list has exactly show_game and show_position linked to the widget', async () => {
    const { tools } = await result(await rpc('tools/list'))
    expect(tools.map((t: any) => t.name)).toEqual(['show_game', 'show_position'])
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object')
      expect(t._meta.ui.resourceUri).toBe('ui://widget/chessmcp-v2.html')
      expect(t._meta['openai/outputTemplate']).toBe('ui://widget/chessmcp-v2.html')
      expect(t.annotations.readOnlyHint).toBe(true)
    }
    expect(tools[0].inputSchema.required).toEqual(['pgn'])
    expect(tools[1].inputSchema.required).toEqual(['fen'])
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

describe('tools/call', () => {
  const call = async (name: string, args: unknown) => result(await rpc('tools/call', { name, arguments: args }))

  test('show_game returns a text summary, a small structuredContent and the game in _meta', async () => {
    const r = await call('show_game', { pgn: PGN })
    expect(r.isError).toBeFalsy()
    expect(r.content[0].text).toContain('Alice vs Bob')
    expect(r.structuredContent.plyCount).toBe(6)
    expect(JSON.stringify(r.structuredContent)).not.toContain('rnbqkbnr')
    expect(r._meta.game.plies.length).toBe(6)
    expect(r._meta.game.startPly).toBe(6)
  })
  test('ply argument selects the starting ply, clamped', async () => {
    expect((await call('show_game', { pgn: PGN, ply: 2 }))._meta.game.startPly).toBe(2)
    expect((await call('show_game', { pgn: PGN, ply: 999 }))._meta.game.startPly).toBe(6)
    expect((await call('show_game', { pgn: PGN, ply: -5 }))._meta.game.startPly).toBe(0)
  })
  test('illegal move → isError naming the move', async () => {
    const r = await call('show_game', { pgn: '1. e4 e5 2. Nf3 Nf3' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/Move 2/)
  })
  test('missing, non-string and oversized pgn → isError', async () => {
    expect((await call('show_game', {})).isError).toBe(true)
    expect((await call('show_game', { pgn: 42 })).isError).toBe(true)
    expect((await call('show_game', { pgn: '1. e4 '.repeat(40_000) })).isError).toBe(true)
  })
  test('show_position renders a FEN with zero plies; bad FEN → isError', async () => {
    const r = await call('show_position', { fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' })
    expect(r.isError).toBeFalsy()
    expect(r._meta.game.plies.length).toBe(0)
    expect((await call('show_position', { fen: 'nope' })).isError).toBe(true)
  })
  test('unknown tool → isError', async () => {
    expect((await call('nope', {})).isError).toBe(true)
  })
})

describe('review fixes: request limits', () => {
  test('a body over 256 KB is rejected with 413', async () => {
    const res = await app.request(`/mcp/${token}`, { method: 'POST', body: 'x'.repeat(300_000) })
    expect(res.status).toBe(413)
  })
  test('batches are rejected as invalid requests, including the empty batch', async () => {
    const post = (body: unknown) =>
      app.request(`/mcp/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    for (const b of [[], [{ jsonrpc: '2.0', id: 1, method: 'ping' }]]) {
      const j = await (await post(b)).json()
      expect(j.error.code).toBe(-32600)
    }
  })
  test('a game over the ply cap returns isError', async () => {
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8']
    const pgn = Array.from({ length: 2001 }, (_, i) => cycle[i % 4]).join(' ')
    const r = await result(await rpc('tools/call', { name: 'show_game', arguments: { pgn } }))
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/2000/)
  })
  test('show_position rejects an impossible position', async () => {
    const r = await result(await rpc('tools/call', { name: 'show_position', arguments: { fen: '4k3/8/8/8/8/8/8/4RK2 w - - 0 1' } }))
    expect(r.isError).toBe(true)
  })
})

describe('tutorials from a position', () => {
  const call = async (name: string, args: unknown) => result(await rpc('tools/call', { name, arguments: args }))
  const KR = '6k1/8/8/8/8/8/4K3/R7 w - - 0 1'

  test('show_position with moves plays the line from that position, starting at the beginning', async () => {
    const r = await call('show_position', { fen: KR, moves: 'Ra7 Kf8 Kf3 Kg8' })
    expect(r.isError).toBeFalsy()
    expect(r._meta.game.plies.map((p: any) => p.san)).toEqual(['Ra7', 'Kf8', 'Kf3', 'Kg8'])
    expect(r._meta.game.startPly).toBe(0)
    expect(r._meta.game.startFen).toBe(KR)
  })
  test('moves may carry move numbers and the ply argument picks the starting move', async () => {
    const r = await call('show_position', { fen: KR, moves: '1. Ra7 Kf8 2. Kf3', ply: 2 })
    expect(r._meta.game.plies.length).toBe(3)
    expect(r._meta.game.startPly).toBe(2)
  })
  test('an illegal move in moves → isError naming the move; non-string moves → isError', async () => {
    const bad = await call('show_position', { fen: KR, moves: 'Ra7 Ke5' })
    expect(bad.isError).toBe(true)
    expect(bad.content[0].text).toMatch(/Ke5/)
    expect((await call('show_position', { fen: KR, moves: 42 })).isError).toBe(true)
  })
  test('a hostile fen cannot inject PGN headers through moves', async () => {
    const r = await call('show_position', { fen: KR + '"]\n[White "x', moves: 'Ra7' })
    expect(r.isError).toBe(true)
  })
  test('descriptions steer the model: show_position says to pass moves for sequences, show_game mentions FEN starts', async () => {
    const { tools } = await result(await rpc('tools/list'))
    expect(tools[1].inputSchema.properties.moves).toBeDefined()
    expect(tools[1].description).toMatch(/moves/)
    expect(tools[1].description).toMatch(/show_game|sequence/)
    expect(tools[0].description).toMatch(/FEN/)
  })
  test('result text tells the model which position and last move are on screen', async () => {
    const r = await call('show_game', { pgn: '1. e4 e5 2. Nf3', ply: 2 })
    const text = r.content[0].text
    expect(text).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2')
    expect(text).toContain('1... e5')
    const fresh = await call('show_position', { fen: KR })
    expect(fresh.content[0].text).toContain(KR)
  })
})

describe('steering the model toward lessons', () => {
  const call = async (name: string, args: unknown) => result(await rpc('tools/call', { name, arguments: args }))
  const KR = '6k1/8/8/8/8/8/4K3/R7 w - - 0 1'

  test('show_position without moves tells the model the board is static and how to fix it', async () => {
    const text = (await call('show_position', { fen: KR })).content[0].text
    expect(text).toMatch(/static/i)
    expect(text).toMatch(/show_game/)
    expect(text).toMatch(/moves/)
  })
  test('the hint is absent when moves were given, and for show_game', async () => {
    expect((await call('show_position', { fen: KR, moves: 'Ra7' })).content[0].text).not.toMatch(/static/i)
    expect((await call('show_game', { pgn: '1. e4 e5' })).content[0].text).not.toMatch(/static/i)
  })
  test('show_position description restricts it to specific positions, never to techniques', async () => {
    const { tools } = await result(await rpc('tools/list'))
    expect(tools[1].description).toMatch(/only/i)
    expect(tools[1].description).toMatch(/never|not/i)
  })
  test('initialize instructions tell the model to use moves for lessons and examples', async () => {
    const r = await result(await rpc('initialize', { protocolVersion: '2025-06-18' }))
    expect(r.instructions).toMatch(/example|lesson|how to/i)
    expect(r.instructions).toMatch(/show_game/)
  })
})
