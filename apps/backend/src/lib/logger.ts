import pino from 'pino';
import { env } from '../config';

/**
 * Application Logger
 *
 * Configured via LOG_LEVEL environment variable
 * Uses Pino for high-performance structured logging
 */

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: env.NODE_ENV,
  },
});

/**
 * Create child logger with additional context
 *
 * @example
 * const log = createLogger({ module: 'auth' });
 * log.info('User logged in');
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
