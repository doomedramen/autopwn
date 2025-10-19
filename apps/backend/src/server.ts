import Fastify from 'fastify';
import { env } from './config';
import { logger } from './lib/logger';

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
 * Health check endpoint
 */
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  };
});

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
