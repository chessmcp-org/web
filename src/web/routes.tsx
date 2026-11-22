import { Hono } from 'hono'
import { makeMcpToken } from '../auth/token'
import { readSession } from '../auth/session'
import { parseFen } from '../chess/fen'
import { PgnError, parseGame } from '../chess/pgn'
import { config } from '../config'
import { renderBoardSvg } from '../render/board'
import { renderWidgetHtml } from '../widget/player'
import { Dashboard } from './dashboard'
import { LOGO_SVG } from './logo'
import { Home } from './home'

const OPERA_GAME =
  '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#'

let sampleBoard: string | undefined
function homeBoard(): string {
  if (!sampleBoard) {
    const game = parseGame(OPERA_GAME)
    const last = game.plies[game.plies.length - 2]! // after 16...Nxb8, before 17.Rd8#
    sampleBoard = renderBoardSvg(parseFen(last.fen), { lastMove: last.move })
  }
  return sampleBoard
}

export function webRoutes(opts: { secret?: string; baseUrl?: string } = {}) {
  const secret = opts.secret ?? config.sessionSecret
  const baseUrl = (opts.baseUrl ?? config.baseUrl).replace(/\/$/, '')
  const dev = !baseUrl.startsWith('https://')
  const app = new Hono()

  app.get('/', (c) => c.html(<Home signedIn={!!readSession(c.req.header('cookie'), secret)} boardSvg={homeBoard()} />))

  app.get('/dashboard', (c) => {
    const user = readSession(c.req.header('cookie'), secret)
    if (!user) return c.redirect('/')
    return c.html(<Dashboard email={user.email} url={`${baseUrl}/mcp/${makeMcpToken(user.sub, secret)}`} />)
  })

  app.get('/healthz', (c) => c.text('ok'))

  for (const path of ['/logo.svg', '/favicon.svg']) {
    app.get(path, (c) => c.body(LOGO_SVG, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }))
  }

  if (dev) {
    // Local-only: render a PGN as the widget, e.g. /preview?pgn=1.+e4+e5
    app.get('/preview', (c) => {
      try {
        return c.html(renderWidgetHtml(parseGame(c.req.query('pgn') ?? '')))
      } catch (e) {
        if (e instanceof PgnError) return c.text(e.message, 400)
        throw e
      }
    })
  }
  return app
}
