import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import { LOGO_SVG } from './logo'

const CSS = `
:root{--pine:#14201c;--pine2:#1c2d27;--line:#2f453c;--ivory:#f2efe6;--muted:#a9b5ad;--brass:#d9b44a;--brass-ink:#241b05;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}
html{background:var(--pine);color-scheme:dark}
body{margin:0;background:var(--pine);color:var(--ivory);font:17px/1.55 var(--sans)}
a{color:var(--brass)}
:focus-visible{outline:3px solid var(--brass);outline-offset:3px;border-radius:4px}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
header.top{display:flex;justify-content:space-between;align-items:center;padding:22px 0}
.brand{font:700 20px var(--serif);color:var(--ivory);text-decoration:none;letter-spacing:.01em}
.brand{display:inline-flex;align-items:center;gap:10px}
.brand b{color:var(--brass)}
.mark{display:block;width:40px;height:40px}.mark svg{display:block;width:100%;height:100%}
header.top form{margin:0}
.link{background:none;border:0;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline;padding:4px}
.btn{display:inline-flex;align-items:center;gap:10px;background:var(--brass);color:var(--brass-ink);font:600 17px var(--sans);padding:13px 22px;border-radius:8px;border:0;text-decoration:none;cursor:pointer}
.btn:hover{background:#e6c35e}
.btn.ghost{background:transparent;color:var(--ivory);border:1px solid var(--line)}
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:56px;align-items:center;padding:36px 0 64px}
h1{font:700 clamp(34px,5.2vw,56px)/1.08 var(--serif);margin:0 0 20px;letter-spacing:-.01em}
.lede{font-size:19px;color:#d8d6cc;max-width:34em;margin:0 0 28px}
.fine{color:var(--muted);font-size:14px;margin:14px 0 0}
.board{border-radius:10px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.board svg{display:block;width:100%;height:auto}
.caption{color:var(--muted);font-size:14px;margin:10px 2px 0}
.steps{border-top:1px solid var(--line);padding:48px 0 56px}
.steps h2,.panel h2{font:700 28px var(--serif);margin:0 0 24px}
ol.how{list-style:none;counter-reset:s;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px}
ol.how li{counter-increment:s;position:relative;padding-top:52px}
ol.how li::before{content:counter(s);position:absolute;top:0;left:0;width:38px;height:38px;border-radius:50%;background:var(--brass);color:var(--brass-ink);font:700 20px/38px var(--serif);text-align:center}
ol.how strong{display:block;font-size:18px;margin-bottom:4px}
ol.how span{color:#d0d3c9}
.prompt{font-family:var(--serif);font-style:italic;color:var(--ivory)}
footer.bottom{border-top:1px solid var(--line);padding:22px 0 40px;color:var(--muted);font-size:13px}
.panel{max-width:720px;padding:24px 0 64px}
.panel p{max-width:38em;color:#d8d6cc}
.urlrow{display:flex;gap:10px;margin:18px 0 8px;flex-wrap:wrap}
.urlrow input{flex:1 1 320px;min-width:0;background:var(--pine2);color:var(--ivory);border:1px solid var(--line);border-radius:8px;padding:13px 14px;font:15px ui-monospace,Menlo,Consolas,monospace}
.warn{color:#e8c9a0;font-size:15px}
ol.plain{padding-left:22px;max-width:38em}
ol.plain li{margin:8px 0}
@media (max-width:820px){.hero{grid-template-columns:1fr;gap:32px;padding-bottom:40px}ol.how{grid-template-columns:1fr;gap:24px}}
`

export function Layout(props: { title: string; user?: string | null; children?: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{props.title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="description" content="Turn any chess game or position into an interactive board inside your ChatGPT conversation." />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div class="wrap">
          <header class="top">
            <a class="brand" href="/">
              <span class="mark">{raw(LOGO_SVG)}</span>
              <span>
                chess<b>mcp</b>.org
              </span>
            </a>
            {props.user ? (
              <form method="post" action="/logout">
                <span class="fine">{props.user} </span>
                <button class="link" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </header>
          {props.children}
          <footer class="bottom">
            Chess pieces: “Staunty” by sadsnake1 (lichess.org), licensed CC BY-NC-SA 4.0.
            <br />
            <a href="/privacy.txt">Privacy</a> · <a href="/terms.txt">Terms</a>
          </footer>
        </div>
      </body>
    </html>
  )
}
