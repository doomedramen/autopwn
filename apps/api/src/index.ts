import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { comprehensiveSecurity } from './middleware/security'
import { authRoutes } from './routes/auth'
import { networksRoutes } from './routes/networks'
import { dictionariesRoutes } from './routes/dictionaries'
import { jobsRoutes } from './routes/jobs'
import { usersRoutes } from './routes/users'
import { uploadRoutes } from './routes/upload'
import { queueManagementRoutes } from './routes/queue-management'
import { checkQueueHealth } from './lib/queue'
import { checkWorkerHealth, closeWorkers } from './workers'
import { createSuperUser } from './db/seed-superuser'
import { runMigrations } from './db/migrate'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', comprehensiveSecurity({
  allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  trustProxy: false
}))

// Health check
app.get('/health', async (c) => {
  const [queueHealth, workerHealth] = await Promise.all([
    checkQueueHealth(),
    Promise.resolve(checkWorkerHealth())
  ])

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'autopwn-api',
    version: '1.0.0',
    queues: queueHealth,
    workers: workerHealth
  })
})

// API routes
app.route('/auth', authRoutes)
app.route('/api/networks', networksRoutes)
app.route('/api/dictionaries', dictionariesRoutes)
app.route('/api/jobs', jobsRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/queue', queueManagementRoutes)

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  }, 500)
})

const port = parseInt(process.env.PORT || '3001')

// Create superuser on startup
async function initializeSuperUser() {
  try {
    await createSuperUser()
  } catch (error) {
    console.error('❌ Failed to create superuser:', error)
    // Continue with server startup even if superuser creation fails
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  await closeWorkers()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  await closeWorkers()
  process.exit(0)
})



// Initialize superuser before starting server
async function startServer() {
  console.log('🔧 Initializing AutoPWN API Server...')
  console.log('📊 Health check: http://localhost:${port}/health')
  console.log('🔄 Background workers initialized')

  // Run database migrations first
  try {
    await runMigrations();
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Failed to run database migrations:', error);
    process.exit(1);
  }

  // Create superuser after migrations
  await initializeSuperUser()

  console.log(`🚀 AutoPWN API Server starting on port ${port}`)

  serve({
    fetch: app.fetch,
    port,
  })
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})