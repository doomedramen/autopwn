import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { env } from './config';
import { logger } from './lib/logger';
import { closeDatabase } from './db';
import { authRoutes } from './routes/auth';

/**
 * Autopwn Backend Server
 *
 * All configuration is read from environment variables at runtime
 * See docs/DEVELOPMENT.md for runtime configuration philosophy
 */

// Environment validation happens on import of ./config/env
// If validation fails, the process will exit before reaching this point

const fastify = Fastify({
  logger,
  trustProxy: true,
  requestIdLogLabel: 'reqId',
});

/**
 * Register plugins
 */
async function registerPlugins() {
  // Cookie support (required for session management)
  await fastify.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
  });

  // CORS support
  await fastify.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
}

/**
 * Register routes
 */
async function registerRoutes() {
  // Authentication routes
  await fastify.register(authRoutes);

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    };
  });
}

/**
 * Initialize server
 */
async function initialize() {
  await registerPlugins();
  await registerRoutes();
}

/**
 * Start server
 */
async function start() {
  try {
    logger.info({
      msg: 'Starting Autopwn Backend',
      config: {
        nodeEnv: env.NODE_ENV,
        host: env.HOST,
        port: env.PORT,
        logLevel: env.LOG_LEVEL,
      },
    });

    // Initialize plugins and routes
    await initialize();

    // Start listening
    await fastify.listen({
      host: env.HOST,
      port: env.PORT,
    });

    logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('Shutting down gracefully...');
  try {
    await fastify.close();
    await closeDatabase();
    logger.info('Server closed');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
start();
