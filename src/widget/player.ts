import { START_FEN, parseFen } from '../chess/fen'
import type { Game } from '../chess/game'
import { renderBoardSvg } from '../render/board'
import { escapeXml } from '../render/escape'
import { ATTRIBUTION } from '../render/pieces'
import CLIENT_JS from './client.js.txt'

/** JSON that is safe inside <script type="application/json">: no raw "<" (blocks </script> and <!--) or line separators. */
function safeJson(value: unknown): string {
  const ls = String.fromCharCode(0x2028)
  const ps = String.fromCharCode(0x2029)
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll(ls, '\\u2028').replaceAll(ps, '\\u2029')
}

export type WidgetData = {
  headers: Record<string, string>
  startFen: string
  result?: string
  /** Ply to show first (0 = start position). Defaults to 0. */
  startPly?: number
  plies: { san: string; fen: string; comment?: string; number: number; color: 'w' | 'b'; from: number; to: number }[]
}

export function widgetData(game: Game, startPly?: number): WidgetData {
  return {
    startPly,
    headers: game.headers,
    startFen: game.startFen,
    result: game.result,
    plies: game.plies.map((p) => ({ san: p.san, fen: p.fen, comment: p.comment, number: p.number, color: p.color, from: p.move.from, to: p.move.to })),
  }
}

const CSS = `
:root{color-scheme:dark;--bg:#262421;--panel:#312e2b;--fg:#e8e6e3;--muted:#a09d98;--accent:#8fbf5a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
#app{max-width:860px;margin:0 auto;padding:12px}
h1{font-size:15px;margin:0 0 8px;font-weight:600}
h1 small{color:var(--muted);font-weight:400;margin-left:8px}
.main{display:flex;flex-wrap:wrap;gap:12px}
#board{flex:1 1 320px;max-width:560px}
#board svg{width:100%;height:auto;display:block;border-radius:6px}
aside{flex:1 1 180px;min-width:160px;display:flex;flex-direction:column}
#moves{background:var(--panel);border-radius:6px;padding:6px;max-height:420px;overflow:auto;position:relative}
.row{display:grid;grid-template-columns:3em 1fr 1fr;align-items:center}
.num{color:var(--muted);padding:2px 4px}
.mv{background:none;border:0;color:var(--fg);font:inherit;text-align:left;padding:2px 6px;border-radius:4px;cursor:pointer}
.mv:hover{background:#3d3a37}
.mv.on{background:var(--accent);color:#14210a;font-weight:600}
#comment{min-height:1.4em;margin-top:8px;color:var(--muted)}
nav{display:flex;gap:6px;align-items:center;margin-top:10px}
nav button{min-width:44px;font-weight:700;background:var(--panel);color:var(--fg);border:1px solid #4a4743;border-radius:6px;padding:6px 14px;font-size:16px;cursor:pointer}
nav button:disabled{opacity:.35;cursor:default}
#status{margin-left:auto;color:var(--muted)}
footer{margin-top:12px;color:var(--muted);font-size:11px}
`

/** `game = null` renders the shell used as the MCP resource: the host later supplies the data (see client.js.txt). */
export function renderWidgetHtml(game: Game | null, startPly?: number): string {
  const h = game?.headers ?? {}
  const players = h.White || h.Black ? `${escapeXml(h.White ?? '?')} vs ${escapeXml(h.Black ?? '?')}` : 'Chess'
  const sub = [h.Event, h.Date, game?.result].filter(Boolean).map((s) => escapeXml(s!)).join(' · ')
  const startFen = game?.startFen ?? START_FEN
  // Empty board (squares + labels + piece defs); the client draws pieces and highlights on top.
  const board = renderBoardSvg({ ...parseFen(startFen), board: Array(64).fill(null) }).replace('<svg ', '<svg id="board-svg" ')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>chessmcp</title><style>${CSS}</style></head>
<body><div id="app">
<h1><span id="title">${players}</span><small id="subtitle">${sub}</small></h1>
<div class="main"><div id="board">${board}</div><aside><div id="moves"></div><div id="comment"></div></aside></div>
<nav aria-label="Playback">
<button id="b-first" type="button" title="Start (Home)">«</button><button id="b-prev" type="button" title="Back (←)">‹</button>
<button id="b-next" type="button" title="Forward (→)">›</button><button id="b-last" type="button" title="End (End)">»</button>
<span id="status"></span></nav>
<footer>${escapeXml(ATTRIBUTION)} · chessmcp.org</footer>
</div>
<script type="application/json" id="game-data">${safeJson(game ? widgetData(game, startPly) : null)}</script>
<script>${CLIENT_JS}</script>
</body></html>`
}
