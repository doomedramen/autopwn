import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

// Basic middleware
app.use('*', logger())
app.use('*', prettyJSON())

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'autopwn-api',
    version: '1.0.0'
  })
})

// Basic test route
app.get('/api/test', (c) => {
  return c.json({
    message: 'API is working'
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  }, 404)
})

const port = parseInt(process.env.PORT || '3001')

console.log(`AutoPWN API Server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port,
}).on('error', (error) => {
  console.error('Server encountered an error', error)
  process.exit(1)
})