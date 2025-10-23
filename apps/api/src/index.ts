import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { cors } from 'hono/cors'

// Import routes
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { jobsRoutes } from './routes/jobs'
import { networksRoutes } from './routes/networks'
import { dictionariesRoutes } from './routes/dictionaries'
import { queueRoutes } from './routes/queue-management'
import { uploadRoutes } from './routes/upload'

// Import middleware
import { securityMiddleware } from './middleware/security'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rateLimit'
import { fileSecurityMiddleware } from './middleware/fileSecurity'
import { errorHandler } from './lib/error-handler'

const app = new Hono()

// Security and utility middleware (applied globally)
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Security middleware
app.use('*', securityMiddleware)

// API routes with authentication
app.route('/auth', authRoutes)
app.route('/users', authMiddleware, usersRoutes)
app.route('/api/jobs', authMiddleware, jobsRoutes)
app.route('/api/networks', authMiddleware, networksRoutes)
app.route('/api/dictionaries', authMiddleware, dictionariesRoutes)
app.route('/api/queue', authMiddleware, queueRoutes)

// Upload routes with additional security
app.use('/api/upload', authMiddleware, fileSecurityMiddleware)
app.route('/api/upload', uploadRoutes)

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'autopwn-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Basic API info route
app.get('/api/info', (c) => {
  return c.json({
    message: 'AutoPWN API is working',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      '/auth/*',
      '/api/jobs/*',
      '/api/networks/*',
      '/api/dictionaries/*',
      '/api/queue/*',
      '/api/upload/*',
      '/health'
    ]
  })
})

// Error handling
app.use('*', errorHandler)

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: c.req.path,
    available_endpoints: [
      '/auth/*',
      '/api/jobs/*',
      '/api/networks/*',
      '/api/dictionaries/*',
      '/api/queue/*',
      '/api/upload/*',
      '/health',
      '/api/info'
    ]
  }, 404)
})

const port = parseInt(process.env.PORT || '3001')

console.log(`🚀 AutoPWN API Server starting on port ${port}`)
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`🔗 Health check: http://localhost:${port}/health`)

serve({
  fetch: app.fetch,
  port,
}).on('error', (error) => {
  console.error('❌ Server encountered an error', error)
  process.exit(1)
})