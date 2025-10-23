import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { comprehensiveSecurity } from './middleware/security'
import { responseCache } from './middleware/responseCache'
import { globalErrorHandler, requestContextMiddleware } from './lib/error-handler'
import { logger as appLogger, extractRequestContext } from './lib/logger'
import { getPerformanceMonitor } from './lib/performance'
import { getCache } from './lib/cache'
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

// Performance monitoring
const performanceMonitor = getPerformanceMonitor()

// Middleware
app.use('*', requestContextMiddleware)
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', responseCache({ enabled: process.env.NODE_ENV !== 'test' }))
app.use('*', comprehensiveSecurity({
  allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  trustProxy: false
}))

// Performance tracking middleware
app.use('*', async (c, next) => {
  const startTime = Date.now()

  try {
    await next()

    const responseTime = Date.now() - startTime
    await performanceMonitor.recordRequest({
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      responseTime,
      timestamp: Date.now(),
      userAgent: c.req.header('user-agent'),
      cached: c.res.headers.get('X-Cache') === 'HIT'
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    await performanceMonitor.recordRequest({
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status || 500,
      responseTime,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
})

// Health check with comprehensive monitoring
app.get('/health', async (c) => {
  try {
    const [queueHealth, workerHealth] = await Promise.all([
      checkQueueHealth(),
      Promise.resolve(checkWorkerHealth())
    ])

    // Get application metrics
    const metrics = AppMonitor.getMetrics()

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'autopwn-api',
      version: '1.0.0',
      uptime: metrics.uptime,
      memory: metrics.memory,
      errors: metrics.errors,
      queues: queueHealth,
      workers: workerHealth
    })
  } catch (error) {
    appLogger.error('Health check failed', 'health', error)
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'autopwn-api',
      version: '1.0.0',
      error: 'Health check failed'
    }, 500)
  }
})

// Enhanced metrics endpoint for monitoring
app.get('/metrics', async (c) => {
  try {
    const [systemMetrics, requestStats, dbStats, cacheStats, recommendations] = await Promise.all([
      performanceMonitor.getMetrics(),
      performanceMonitor.getRequestStats(1),
      performanceMonitor.getDatabaseStats(),
      performanceMonitor.getCacheStats(),
      performanceMonitor.getRecommendations()
    ])

    return c.json({
      system: systemMetrics,
      requests: requestStats,
      database: dbStats,
      cache: cacheStats,
      recommendations,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    appLogger.error('Metrics retrieval failed', 'metrics', error)
    return c.json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Performance optimization endpoint
app.post('/optimize', async (c) => {
  try {
    await performanceMonitor.optimizeSystem()

    return c.json({
      success: true,
      message: 'Performance optimization completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    appLogger.error('Performance optimization failed', 'metrics', error)
    return c.json({
      success: false,
      error: 'Performance optimization failed',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Cache management endpoint
app.post('/cache/clear', async (c) => {
  try {
    const cache = getCache()
    const cleared = await cache.clear()

    return c.json({
      success: true,
      cleared,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    appLogger.error('Cache clear failed', 'cache', error)
    return c.json({
      success: false,
      error: 'Cache clear failed',
      timestamp: new Date().toISOString()
    }, 500)
  }
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

// Global error handler
app.onError(globalErrorHandler)

// Log server startup
appLogger.info('AutoPWN API Server initialized', 'system', {
  nodeEnv: process.env.NODE_ENV,
  version: '1.0.0'
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
  appLogger.info('Initializing AutoPWN API Server...', 'system')

  // Run database migrations first
  try {
    appLogger.info('Running database migrations...', 'database')
    const startTime = Date.now()
    await runMigrations()
    const duration = Date.now() - startTime
    appLogger.info('Database migrations completed successfully', 'database', {
      duration,
      success: true
    })
  } catch (error) {
    appLogger.error('Failed to run database migrations', 'database', error, {
      fatal: true
    })
    process.exit(1)
  }

  // Create superuser after migrations
  try {
    appLogger.info('Creating/verifying superuser account...', 'database')
    await initializeSuperUser()
    appLogger.info('Superuser setup completed', 'database')
  } catch (error) {
    appLogger.warn('Superuser creation failed, continuing startup', 'database', error)
    // Continue with server startup even if superuser creation fails
  }

  const serverUrl = `http://localhost:${port}`
  appLogger.info(`AutoPWN API Server starting on port ${port}`, 'system', {
    serverUrl,
    healthCheckUrl: `${serverUrl}/health`,
    nodeEnv: process.env.NODE_ENV
  })

  serve({
    fetch: app.fetch,
    port,
    onCreate: () => {
      appLogger.info('Server created successfully', 'system')
    }
  }).on('error', (error) => {
    appLogger.error('Server encountered an error', 'system', error, {
      fatal: true
    })
    process.exit(1)
  })
}

startServer()