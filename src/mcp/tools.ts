import { parseFen, toFen } from '../chess/fen'
import { gameFromFen } from '../chess/game'
import { PgnError, parseGame } from '../chess/pgn'
import type { Game } from '../chess/game'
import { widgetData } from '../widget/player'

export const WIDGET_URI = 'ui://widget/chessmcp-v1.html'
export const WIDGET_MIME = 'text/html;profile=mcp-app'
export const MAX_PGN_CHARS = 200_000

const widgetMeta = (invoking: string, invoked: string) => ({
  ui: { resourceUri: WIDGET_URI },
  'openai/outputTemplate': WIDGET_URI,
  'openai/toolInvocation/invoking': invoking,
  'openai/toolInvocation/invoked': invoked,
})
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }

export const TOOLS = [
  {
    name: 'show_game',
    title: 'Show chess game',
    description:
      'Show a chess game or lesson as an interactive board the user can step through move by move. Pass the full game as PGN (standard movetext, optional headers and comments). To start from a custom position (a tutorial, endgame or puzzle), put [SetUp "1"] and [FEN "..."] headers before the moves. Prefer this tool whenever the user wants to learn or follow a sequence of moves.',
    inputSchema: {
      type: 'object',
      properties: {
        pgn: { type: 'string', description: 'The game in PGN format.' },
        ply: { type: 'integer', description: 'Half-move to show first (0 = start position). Defaults to the end of the game.' },
      },
      required: ['pgn'],
    },
    annotations,
    _meta: widgetMeta('Setting up the board…', 'Board ready'),
  },
  {
    name: 'show_position',
    title: 'Show chess position',
    description:
      'Show one chess position from a FEN string on an interactive board. For a single static position, pass only fen. To teach a sequence from that position (a mating technique, an opening line, a puzzle solution), also pass moves (SAN, e.g. "Ra7 Kf8 Kf3") so the user can step through them; this is the same as calling show_game with a FEN header.',
    inputSchema: {
      type: 'object',
      properties: {
        fen: { type: 'string', description: 'The position in FEN notation.' },
        moves: { type: 'string', description: 'Optional moves to play from the position, in SAN separated by spaces (move numbers allowed).' },
        ply: { type: 'integer', description: 'Half-move to show first (0 = the given position, the default).' },
      },
      required: ['fen'],
    },
    annotations,
    _meta: widgetMeta('Setting up the board…', 'Position ready'),
  },
]

export type ToolResult = {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  _meta?: Record<string, unknown>
  isError?: boolean
}

const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true })

function describe(game: Game, startPly: number): ToolResult {
  const h = game.headers
  const title = h.White || h.Black ? `${h.White ?? '?'} vs ${h.Black ?? '?'}` : game.plies.length ? 'Chess game' : 'Chess position'
  const parts = [title]
  if (game.plies.length) parts.push(`${game.plies.length} half-moves`)
  if (game.result) parts.push(`result ${game.result}`)
  const shown = startPly > 0 ? game.plies[startPly - 1] : undefined
  const fen = shown ? shown.fen : game.startFen
  const last = shown ? ` Last move: ${shown.number}${shown.color === 'w' ? '.' : '...'} ${shown.san}.` : ''
  return {
    content: [
      {
        type: 'text',
        text: `${parts.join(', ')}. An interactive board is shown to the user at ply ${startPly}.${last} Position shown (FEN): ${fen}`,
      },
    ],
    // structuredContent is visible to the model, so keep it small; the full game goes in _meta (component only).
    structuredContent: { title, plyCount: game.plies.length, startPly, result: game.result ?? null, fen },
    _meta: { game: widgetData(game, startPly) },
  }
}

export function callTool(name: string, args: unknown): ToolResult {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>
  try {
    if (name === 'show_game') {
      if (typeof a.pgn !== 'string') return fail('Argument "pgn" must be a string containing the game in PGN format.')
      if (a.pgn.length > MAX_PGN_CHARS) return fail(`PGN is too large (limit ${MAX_PGN_CHARS} characters).`)
      const game = parseGame(a.pgn)
      const requested = typeof a.ply === 'number' && Number.isFinite(a.ply) ? Math.trunc(a.ply) : game.plies.length
      return describe(game, Math.max(0, Math.min(game.plies.length, requested)))
    }
    if (name === 'show_position') {
      if (typeof a.fen !== 'string') return fail('Argument "fen" must be a string.')
      if (a.moves !== undefined && typeof a.moves !== 'string') return fail('Argument "moves" must be a string of SAN moves.')
      const start = toFen(parseFen(a.fen)) // validates and normalizes, so it is safe to embed in a header
      if (typeof a.moves !== 'string' || !a.moves.trim()) return describe(gameFromFen(start), 0)
      if (a.moves.length > MAX_PGN_CHARS) return fail(`Moves are too long (limit ${MAX_PGN_CHARS} characters).`)
      const game = parseGame(`[SetUp "1"]\n[FEN "${start}"]\n\n${a.moves}`)
      const requested = typeof a.ply === 'number' && Number.isFinite(a.ply) ? Math.trunc(a.ply) : 0
      return describe(game, Math.max(0, Math.min(game.plies.length, requested)))
    }
    return fail(`Unknown tool "${name}".`)
  } catch (e) {
    if (e instanceof PgnError || e instanceof Error) return fail(e.message)
    throw e
  }
}
