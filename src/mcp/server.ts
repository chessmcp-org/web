import { Hono } from 'hono'
import { verifyMcpToken } from '../auth/token'
import { config } from '../config'
import { renderWidgetHtml } from '../widget/player'
import { TOOLS, WIDGET_MIME, WIDGET_URI, callTool } from './tools'

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: any }

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message)
  }
}

let shell: string | undefined

function handle(method: string, params: any): unknown {
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : '2025-06-18',
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'chessmcp', title: 'chessmcp.org', version: '0.1.0' },
        instructions: 'Use show_game to display a PGN game, or show_position to display a FEN position, as an interactive board.',
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

function respond(msg: Rpc): object | null {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } }
  }
  const isNotification = msg.id === undefined
  try {
    const result = handle(msg.method, msg.params)
    return isNotification ? null : { jsonrpc: '2.0', id: msg.id, result }
  } catch (e) {
    if (isNotification) return null
    const code = e instanceof RpcError ? e.code : -32603
    return { jsonrpc: '2.0', id: msg.id, error: { code, message: (e as Error).message } }
  }
}

/** Stateless streamable-HTTP MCP endpoint at /mcp/:token (JSON responses, no sessions). */
export function mcpRoutes(opts: { secret?: string } = {}) {
  const secret = opts.secret ?? config.sessionSecret
  const app = new Hono()
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
      const out = body.map((m) => respond(m as Rpc)).filter((r) => r !== null)
      return out.length ? c.json(out) : c.body(null, 202)
    }
    const out = respond(body as Rpc)
    return out ? c.json(out) : c.body(null, 202)
  })
  return app
}
