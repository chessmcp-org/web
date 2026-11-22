import { raw } from 'hono/html'
import { Layout } from './layout'

export function Home(props: { signedIn: boolean; boardSvg: string }) {
  return (
    <Layout title="chessmcp.org: chess boards inside ChatGPT">
      <section class="hero">
        <div>
          <h1>Learn chess inside your ChatGPT conversation</h1>
          <p class="lede">
            Ask ChatGPT to walk you through a game, an opening or a tricky position. chessmcp.org turns the answer into a
            board you can step through, move by move, without leaving the chat.
          </p>
          {props.signedIn ? (
            <a class="btn" href="/dashboard">
              Open your dashboard
            </a>
          ) : (
            <a class="btn" href="/login">
              Sign in with Google
            </a>
          )}
          <p class="fine">Signing in gives you a private link to add to ChatGPT. We don’t store your games.</p>
        </div>
        <figure style="margin:0">
          <div class="board">{raw(props.boardSvg)}</div>
          <figcaption class="caption">Morphy’s Opera Game, one move before the mate. In ChatGPT the board is interactive: step forward and back through every move.</figcaption>
        </figure>
      </section>
      <section class="steps">
        <h2>Connect it in three steps</h2>
        <ol class="how">
          <li>
            <strong>Sign in</strong>
            <span>Use your Google account. You get a private link that only works for you.</span>
          </li>
          <li>
            <strong>Add the link to ChatGPT</strong>
            <span>Paste it as a custom MCP server in ChatGPT’s plugin settings. No other setup.</span>
          </li>
          <li>
            <strong>Ask for a board</strong>
            <span class="prompt">“Show me the Opera Game and explain each move.”</span>
          </li>
        </ol>
      </section>
    </Layout>
  )
}
