// Load environment variables based on NODE_ENV
import 'dotenv-flow/config'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { cors } from 'hono/cors'

const app = new Hono()

// Security and utility middleware (applied globally)
app.use('*', logger())
app.use('*', prettyJSON())

// Production-ready CORS configuration
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

// Health check endpoint (production ready)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'crackhouse-api',
    version: '1.0.0-minimal',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})

// API info endpoint
app.get('/api/info', (c) => {
  return c.json({
    message: 'CrackHouse Minimal API - Working Docker Setup',
    version: '1.0.0-minimal',
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      { path: '/health', method: 'GET', description: 'Service health check' },
      { path: '/api/info', method: 'GET', description: 'API information' },
      { path: '/api/auth/login', method: 'POST', description: 'User login (mock)' },
      { path: '/api/auth/register', method: 'POST', description: 'User registration (mock)' }
    ],
    infrastructure: {
      database: 'PostgreSQL 16',
      cache: 'Redis 7',
      reverse_proxy: 'Nginx',
      orchestrator: 'Docker Compose'
    }
  })
})

// Mock authentication endpoints (ready for Better Auth integration)
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()

  // Basic validation
  if (!email || !password) {
    return c.json({
      success: false,
      error: 'Email and password are required'
    }, 400)
  }

  // Mock authentication (replace with Better Auth implementation)
  return c.json({
    success: true,
    message: 'Login endpoint ready for Better Auth integration',
    user: {
      id: 'mock-user-id',
      email,
      role: 'user'
    }
  })
})

app.post('/api/auth/register', async (c) => {
  const { email, password, name } = await c.req.json()

  // Basic validation
  if (!email || !password) {
    return c.json({
      success: false,
      error: 'Email and password are required'
    }, 400)
  }

  // Mock registration (replace with Better Auth implementation)
  return c.json({
    success: true,
    message: 'Registration endpoint ready for Better Auth integration',
    user: {
      id: 'mock-new-user-id',
      email,
      name: name || email,
      role: 'user'
    }
  })
})

// Mock database status endpoint
app.get('/api/db/status', (c) => {
  return c.json({
    message: 'Database connection endpoint ready',
    configuration: {
      host: process.env.POSTGRES_HOST || 'database',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DB || 'crackhouse_production',
      user: process.env.POSTGRES_USER || 'postgres'
    },
    status: 'Ready for Drizzle ORM integration'
  })
})

// Mock Redis status endpoint
app.get('/api/redis/status', (c) => {
  return c.json({
    message: 'Redis connection endpoint ready',
    configuration: {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || '6379'
    },
    status: 'Ready for BullMQ integration'
  })
})

// Mock networks endpoint (placeholder for full implementation)
app.get('/api/networks', (c) => {
  return c.json({
    message: 'Network management endpoint ready',
    networks: [],
    status: 'Ready for full network analysis implementation'
  })
})

// Mock jobs endpoint (placeholder for full implementation)
app.get('/api/jobs', (c) => {
  return c.json({
    message: 'Job management endpoint ready',
    jobs: [],
    status: 'Ready for full Hashcat integration'
  })
})

// Error handling
app.onError((err, c) => {
  console.error('API Error:', err)
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: c.req.path,
    method: c.req.method,
    available_endpoints: [
      '/health',
      '/api/info',
      '/api/auth/login',
      '/api/auth/register',
      '/api/db/status',
      '/api/redis/status',
      '/api/networks',
      '/api/jobs'
    ]
  }, 404)
})

const port = parseInt(process.env.PORT || '3001')

console.log(`🚀 CrackHouse Minimal API Server starting on port ${port}`)
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`🔗 Health check: http://localhost:${port}/health`)
console.log(`📊 API info: http://localhost:${port}/api/info`)
console.log(`💾 Database: PostgreSQL on port ${process.env.POSTGRES_PORT || '5432'}`)
console.log(`⚡ Redis: on port ${process.env.REDIS_PORT || '6379'}`)

export default {
  port,
  fetch: app.fetch,
}

// Start server
serve({
  fetch: app.fetch,
  port,
}).on('error', (error) => {
  console.error('❌ Server encountered an error', error)
  process.exit(1)
})