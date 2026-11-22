import { parseFen, toFen } from '../chess/fen'
import type { Game } from '../chess/game'
import { parseGame } from '../chess/pgn'
import { widgetData } from '../widget/player'

export const WIDGET_URI = 'ui://widget/chessmcp-v2.html'
export const WIDGET_MIME = 'text/html;profile=mcp-app'
export const MAX_PGN_CHARS = 200_000
export const DEFAULT_DELAY_MS = 1500
export const MIN_DELAY_MS = 300
export const MAX_DELAY_MS = 10_000

export const TOOLS = [
  {
    name: 'show_lesson',
    title: 'Show chess lesson',
    description:
      'Show a chess lesson: a sequence of moves that auto-plays on an interactive board, one move at a time, with a delay between moves. The user can pause, step backward and forward, and replay. Use it for any example, technique, opening, endgame method, puzzle solution or game the user wants to see or learn. Write out the complete line in moves (SAN, e.g. "1. Ra7 Kf8 2. Kf3"). Add a short comment after important moves in curly braces, e.g. "1. Ra7 {Cuts off the king along the 7th rank} Kf8"; each comment is shown as a caption while that move is on the board. Start from a custom position by passing fen; otherwise it starts from the standard starting position. Moves may also be a full PGN.',
    inputSchema: {
      type: 'object',
      properties: {
        moves: {
          type: 'string',
          description: 'The moves in SAN or PGN movetext. Move numbers and {comments} are allowed. Must contain at least one move.',
        },
        fen: { type: 'string', description: 'Optional starting position in FEN. Defaults to the standard starting position.' },
        title: { type: 'string', description: 'Optional short title shown above the board, e.g. "Rook and king checkmate".' },
        seconds_per_move: { type: 'number', description: 'Optional pause between moves while playing, in seconds (0.3 to 10). Default 1.5.' },
      },
      required: ['moves'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: {
      ui: { resourceUri: WIDGET_URI },
      'openai/outputTemplate': WIDGET_URI,
      'openai/toolInvocation/invoking': 'Setting up the lesson…',
      'openai/toolInvocation/invoked': 'Lesson ready',
    },
  },
]

export type ToolResult = {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  _meta?: Record<string, unknown>
  isError?: boolean
}

const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true })

function moveListText(game: Game): string {
  return game.plies.map((p, i) => (p.color === 'w' ? `${p.number}. ${p.san}` : i === 0 ? `${p.number}... ${p.san}` : p.san)).join(' ')
}

function describe(game: Game, title: string | undefined, delayMs: number): ToolResult {
  const h = game.headers
  const name = title ?? (h.White || h.Black ? `${h.White ?? '?'} vs ${h.Black ?? '?'}` : 'Chess lesson')
  const moves = moveListText(game)
  return {
    content: [
      {
        type: 'text',
        text:
          `${name}: ${game.plies.length} half-moves. The lesson auto-plays on an interactive board shown to the user, ` +
          `with pause, step and replay controls. Start position (FEN): ${game.startFen}. Moves: ${moves.length > 1500 ? moves.slice(0, 1500) + '…' : moves}`,
      },
    ],
    // structuredContent is visible to the model, so keep it small; the full game goes in _meta (component only).
    structuredContent: { title: name, plyCount: game.plies.length, startFen: game.startFen },
    _meta: { game: widgetData(game, { title: name, delayMs }) },
  }
}

export function callTool(name: string, args: unknown): ToolResult {
  if (name !== 'show_lesson') return fail(`Unknown tool "${name}".`)
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>
  try {
    if (typeof a.moves !== 'string') return fail('Argument "moves" must be a string of chess moves (SAN or PGN movetext).')
    if (!a.moves.trim()) return fail('A lesson needs at least one move in "moves".')
    if (a.moves.length > MAX_PGN_CHARS) return fail(`Moves are too long (limit ${MAX_PGN_CHARS} characters).`)
    if (a.fen !== undefined && typeof a.fen !== 'string') return fail('Argument "fen" must be a string.')
    if (a.title !== undefined && typeof a.title !== 'string') return fail('Argument "title" must be a string.')
    const title = typeof a.title === 'string' && a.title.trim() ? a.title.trim().slice(0, 120) : undefined
    const seconds = typeof a.seconds_per_move === 'number' && Number.isFinite(a.seconds_per_move) ? a.seconds_per_move : DEFAULT_DELAY_MS / 1000
    const delayMs = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, Math.round(seconds * 1000)))
    // Normalizing through toFen validates the FEN and makes it safe to embed in a header.
    const header = typeof a.fen === 'string' ? `[SetUp "1"]\n[FEN "${toFen(parseFen(a.fen))}"]\n\n` : ''
    const game = parseGame(header + a.moves)
    if (game.plies.length === 0) return fail('A lesson needs at least one move in "moves".')
    return describe(game, title, delayMs)
  } catch (e) {
    if (e instanceof Error) return fail(e.message)
    throw e
  }
}
