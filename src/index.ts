import { Hono } from 'hono'
import { authRoutes } from './auth/routes'
import { config } from './config'
import { mcpRoutes } from './mcp/server'
import { webRoutes } from './web/routes'

const app = new Hono()
app.route('/', authRoutes())
app.route('/', mcpRoutes())
app.route('/', webRoutes())
app.notFound((c) => c.text('Not found', 404))

console.log(`chessmcp listening on ${config.baseUrl} (port ${config.port})`)
export default { port: config.port, fetch: app.fetch }
