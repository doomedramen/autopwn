import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { cors } from 'hono/cors'
import { environmentAwareCORS, publicApiCORS } from './middleware/cors'

// Import routes
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { jobsRoutes } from './routes/jobs'
import { networksRoutes } from './routes/networks'
import { dictionariesRoutes } from './routes/dictionaries'
import { queueRoutes } from './routes/queue-management'
import { uploadRoutes } from './routes/upload'
import { securityRoutes } from './routes/security-monitoring'
import { virusScannerRoutes } from './routes/virus-scanner'

// Import middleware
import { securityMiddleware } from './middleware/security'
import { authMiddleware } from './middleware/auth'
import { rateLimit, strictRateLimit, uploadRateLimit } from './middleware/rateLimit'
import { fileSecurityMiddleware } from './middleware/fileSecurity'
import { dbSecurityMiddleware, parameterValidationMiddleware } from './middleware/db-security'
import { securityHeaderValidator } from './middleware/security-header-validator'
import { errorHandler } from './lib/error-handler'

const app = new Hono()

// Security and utility middleware (applied globally)
app.use('*', logger())
app.use('*', prettyJSON())

// Environment-aware CORS configuration
app.use('*', environmentAwareCORS())

// Database security and parameter validation
app.use('*', dbSecurityMiddleware())
app.use('*', parameterValidationMiddleware())

// Security header validation
app.use('*', securityHeaderValidator())

// Security middleware
app.use('*', securityMiddleware)

// API routes with authentication and rate limiting
app.route('/auth', rateLimit(), authRoutes)
app.route('/users', rateLimit(), authMiddleware, usersRoutes)
app.route('/api/jobs', rateLimit(), authMiddleware, jobsRoutes)
app.route('/api/networks', rateLimit(), authMiddleware, networksRoutes)
app.route('/api/dictionaries', rateLimit(), authMiddleware, dictionariesRoutes)
app.route('/api/queue', strictRateLimit(), authMiddleware, queueRoutes)

// Upload routes with additional security and stricter rate limiting
app.use('/api/upload', rateLimit(), authMiddleware, fileSecurityMiddleware)
app.route('/api/upload', uploadRateLimit(), uploadRoutes)

// Security monitoring routes (admin only)
app.route('/security', rateLimit(), authMiddleware, securityRoutes)

// Virus scanner routes (admin only)
app.route('/virus-scanner', rateLimit(), authMiddleware, virusScannerRoutes)

// Health check (no auth required) - Public CORS
app.get('/health', publicApiCORS(), (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'autopwn-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Basic API info route - Public CORS
app.get('/api/info', publicApiCORS(), (c) => {
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
      '/security/*',
      '/virus-scanner/*',
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
      '/security/*',
      '/virus-scanner/*',
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