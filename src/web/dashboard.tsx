import { Layout } from './layout'

const COPY_JS = `
document.getElementById('copy').addEventListener('click',function(){
  var i=document.getElementById('mcp-url');i.select();
  var done=function(){document.getElementById('copy').textContent='Copied'};
  if(navigator.clipboard){navigator.clipboard.writeText(i.value).then(done,function(){document.execCommand('copy');done()})}
  else{document.execCommand('copy');done()}
});`

export function Dashboard(props: { email: string; url: string }) {
  return (
    <Layout title="Your link: chessmcp.org" user={props.email}>
      <section class="panel">
        <h2>Your private link</h2>
        <p>Add this link to ChatGPT as a custom MCP server. It is tied to your Google account and needs no password.</p>
        <div class="urlrow">
          <input id="mcp-url" type="text" readonly value={props.url} aria-label="Your private MCP link" />
          <button id="copy" class="btn" type="button">
            Copy link
          </button>
        </div>
        <p class="warn">Anyone who has this link can use your connector. Don’t share it.</p>
        <h2 style="margin-top:40px">Add it to ChatGPT</h2>
        <ol class="plain">
          <li>Open ChatGPT and go to its plugin settings (chatgpt.com/plugins).</li>
          <li>Choose “Add custom MCP server”.</li>
          <li>Paste your link as the server URL and set authentication to none. The link itself is the key.</li>
          <li>Start a new chat and ask: “Teach me how to checkmate with a king and a rook.”</li>
        </ol>
      </section>
      <script dangerouslySetInnerHTML={{ __html: COPY_JS }} />
    </Layout>
  )
}
