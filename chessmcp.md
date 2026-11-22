# chessmcp.org: Project Plan

Visualize chess games / tutorials / positions as interactive SVG boards, embedded in ChatGPT via an MCP server.

## Decisions (agreed)
- Stack: Bun, TypeScript, Hono. Own PGN/FEN parser, move validator and SVG renderer (no FEN2SVG / PGN2SVG libs).
- Pieces: lichess `staunty` SVG set. **Licence to verify** (believed CC BY-NC-SA 4.0: non-commercial, attribution required). Attribution goes in the footer.
- Stateless: no database. PGN arrives as a tool argument (or via a paste box on the site).
- Clients: ChatGPT only for now (MCP Apps / Apps SDK: tool result + `ui://` HTML widget in a sandboxed iframe).
- Login: Google OAuth (server-side code flow). Session = HMAC-signed, HttpOnly, Secure, SameSite=Lax cookie holding Google `sub` + email.
- MCP auth: private URL `https://chessmcp.org/mcp/<token>`, token = base64url(sub) + HMAC(SECRET). Added in ChatGPT as a connector with no auth. Revocation = rotate the secret (revokes everyone). No usage limits or abuse detection for now.
- Hosting: DigitalOcean App Platform (Dockerfile build) in the DO project "chessmcp.org". DNS in Cloudflare.

## Direction change: lessons (22 Nov 2026)
The MCP server now exposes a single tool, `show_lesson({ moves, fen?, title?, seconds_per_move? })`. A lesson is a series of moves that auto-plays with a delay (default 1.5 s). The user can pause, step back and forward, and replay; `{comments}` in the moves show as captions. `show_game` and `show_position` were removed. Widget resource: `ui://widget/chessmcp-v2.html`.

## Architecture
```
src/
  index.ts            Hono app, routes
  chess/              fen.ts, pgn.ts, rules.ts (legal moves, SAN), game.ts (positions timeline)
  render/             board.ts (SVG), pieces.ts (inlined staunty), overlays.ts (arrows, highlights)
  widget/             self-contained HTML+JS player (SVG + controls), served as ui:// resource
  mcp/                streamable-HTTP MCP server, tools
  auth/               google.ts, session.ts (signed cookie), token.ts (MCP URL token)
  web/                home page, dashboard
Dockerfile, app.yml
```
Routes: `/` home, `/login` (Google callback; also starts flow), `/logout`, `/dashboard` (shows the private MCP URL), `/mcp/:token` (MCP), `/healthz`, `/render` (static SVG/preview from PGN).

## Versions

### v0.1: MVP (live at chessmcp.org)
- Chess core: FEN, PGN (headers, SAN, comments, variations ignored or flattened), legal-move validation.
- SVG renderer: board, coordinates, staunty pieces, last-move highlight, flip.
- Widget: step forward/back, start/end, move list. Embedded in the MCP tool result.
- MCP tools: `show_game(pgn)` and `show_position(fen)`, both returning the widget.
- Home page (explains the product), Google login, dashboard with copyable MCP URL and ChatGPT setup steps.
- Dockerfile, `app.yml`, deployed to DO, domain on Cloudflare, HTTPS working.
- Tests: parser and rules (perft-style checks), renderer snapshots, token and session signing.

### v0.2: Teaching features
- Cell highlighting and multiple arrows (colours), via tool arguments and PGN `[%csl]` / `[%cal]` comment annotations.
- Autoplay (play/pause, speed, loop), keyboard shortcuts.
- Tutorial mode: per-move captions from PGN comments.

### v0.3: Polish
- Better responsive layout inside the ChatGPT iframe, dark/light theme, drag-free move-list navigation.
- Static fallback (SVG/PNG) for hosts that don't render widgets.
- Variations, NAG glyphs, eval bar if present in PGN.

### Later
- Full OAuth 2.1 for the MCP server, a regenerate-link button (would need state), Gemini and other clients, rate limits.

## What I need from you

### Google (from your screenshot: client `806440966352-ijjo...apps.googleusercontent.com`)
1. **Client secret**: not visible in the screenshot. Give it to me out-of-band, or set it yourself as a DO secret `GOOGLE_CLIENT_SECRET`. Don't paste it in chat if you'd rather not.
2. **Redirect URIs**: you have `https://chessmcp.org/login`, `https://localhost/login`, `http://localhost/login`. For local dev I'll run on a port, and Google requires the **exact port**, so add `http://localhost:3000/login`.
3. **Consent screen > Audience**: set to **In production** (scopes `openid email profile` need no verification). Otherwise only listed test users can log in.
4. JS origins can stay empty (server-side flow).

### DigitalOcean
5. A **personal access token** (read and write for Apps) or `doctl auth init` already done on this machine. I'll check if `doctl` is installed.
6. App Platform deploys from **GitHub** (or a registry). I need a GitHub repo (name and access via `gh` here) and the DO GitHub integration authorised.
7. Project: the link you pasted is a **DigitalOcean** project (id `c68a3e88-a621-4aaa-80d5-396df5673897`). You wrote "on cloudflare", so I'm assuming you meant DO. I'll create the app inside that project.
8. Preferred region and size (default: `fra`, basic-xxs, about $5/mo).

### Cloudflare
9. An **API token** with Zone: DNS: Edit for `chessmcp.org`, plus the zone ID (or access to run `curl` against the API). I'll add the CNAME to the DO app domain.
10. SSL/TLS mode: I'll use **DNS-only** at first so DO issues the cert, then optionally switch to proxied with "Full (strict)". Tell me if you want proxied from day one.

### Product
11. Confirm the piece **licence** is acceptable (non-commercial; will the site ever charge?).
12. Contact or support email for the footer, if you want one.

### I'll generate
- `SESSION_SECRET` / MCP token secret (random 32 bytes) and set it as a DO encrypted env var.

## Environment variables
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `BASE_URL` (`https://chessmcp.org` or `http://localhost:3000`), `PORT`.

## Risks / open items
- ChatGPT connector setup needs developer mode, and its MCP Apps widget behaviour (CSP, iframe sandbox, `window.openai`) must be tested live. I'll budget time for iteration on the widget.
- Secret-URL tokens can't be revoked individually (accepted).
- Staunty licence (see above).
