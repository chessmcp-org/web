import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { verifyMcpToken } from '../auth/token'
import { config } from '../config'
import { renderWidgetHtml } from '../widget/player'
import { TOOLS, WIDGET_MIME, WIDGET_URI, callTool } from './tools'

const MAX_BODY_BYTES = 256 * 1024
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: any }

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message)
  }
}

let shell: string | undefined

function handle(method: string, params: any, baseUrl: string): unknown {
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : '2025-06-18',
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: {
          name: 'chessmcp',
          title: 'chessmcp.org',
          version: '0.1.0',
          icons: [{ src: `${baseUrl}/logo-512.png`, mimeType: 'image/png', sizes: ['512x512'] }],
        },
        instructions:
          'Teach chess with an interactive board. For any lesson, example, technique, opening, endgame method, puzzle solution or \"how to\" question, write out the complete sequence of moves and call show_lesson: it auto-plays the moves one by one and the user can pause, step and replay. Add short {comments} after the key moves to explain them. Pass fen to start from a custom position.',
      }
    }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: TOOLS }
    case 'tools/call':
      return callTool(String(params?.name ?? ''), params?.arguments)
    case 'resources/list':
      return { resources: [{ uri: WIDGET_URI, name: 'chessmcp-board', title: 'Chess board', mimeType: WIDGET_MIME }] }
    case 'resources/templates/list':
      return { resourceTemplates: [] }
    case 'resources/read': {
      if (params?.uri !== WIDGET_URI) throw new RpcError(-32002, `Resource not found: ${params?.uri}`)
      shell ??= renderWidgetHtml(null)
      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: WIDGET_MIME,
            text: shell,
            _meta: { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } } },
          },
        ],
      }
    }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`)
  }
}

function respond(msg: Rpc, baseUrl: string): object | null {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } }
  }
  const isNotification = msg.id === undefined
  try {
    const result = handle(msg.method, msg.params, baseUrl)
    return isNotification ? null : { jsonrpc: '2.0', id: msg.id, result }
  } catch (e) {
    if (isNotification) return null
    const code = e instanceof RpcError ? e.code : -32603
    return { jsonrpc: '2.0', id: msg.id, error: { code, message: (e as Error).message } }
  }
}

/** Stateless streamable-HTTP MCP endpoint at /mcp/:token (JSON responses, no sessions). */
export function mcpRoutes(opts: { secret?: string; baseUrl?: string } = {}) {
  const secret = opts.secret ?? config.sessionSecret
  const baseUrl = (opts.baseUrl ?? config.baseUrl).replace(/\/$/, '')
  const app = new Hono()
  app.use(
    '/mcp/:token',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'Request body too large' }, 413) }),
  )
  app.all('/mcp/:token', async (c) => {
    if (!verifyMcpToken(c.req.param('token'), secret)) return c.json({ error: 'Invalid MCP link' }, 401)
    if (c.req.method !== 'POST') return c.text('Method not allowed', 405, { Allow: 'POST' })
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }
    if (Array.isArray(body)) {
      return c.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported' } })
    }
    const out = respond(body as Rpc, baseUrl)
    return out ? c.json(out) : c.body(null, 202)
  })
  return app
}
