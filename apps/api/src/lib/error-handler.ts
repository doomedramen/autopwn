import { Context, Next } from 'hono'
import { logger } from './logger'
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  FileSystemError
} from './logger'

/**
 * Standard error response structure
 */
interface ErrorResponse {
  success: false
  error: string
  code: string
  message?: string
  details?: any
  timestamp: string
  requestId?: string
}

/**
 * Centralized error handler for the application
 */
export const globalErrorHandler = async (err: Error, c: Context) => {
  const requestId = c.get('requestId') || c.req.header('x-request-id') || 'unknown'

  // Log the error with full context
  const context = c.get('route') || 'unknown'
  const userId = c.get('userId')

  if (err instanceof AppError) {
    // Known application errors
    logger.error(err.message, context, err, {
      errorType: err.constructor.name,
      code: err.code,
      statusCode: err.statusCode,
      isOperational: err.isOperational,
      userId,
      requestId
    })

    const response: ErrorResponse = {
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
      requestId
    }

    // Only include stack trace in development for operational errors
    if (process.env.NODE_ENV === 'development' && !err.isOperational) {
      response.details = {
        stack: err.stack,
        context: err.context
      }
    }

    return c.json(response, err.statusCode)
  } else {
    // Unknown errors (programming errors, etc.)
    logger.error('Unexpected application error', context, err, {
      errorType: 'UnknownError',
      isOperational: false,
      userId,
      requestId
    })

    // Don't expose internal error details in production
    const response: ErrorResponse = {
      success: false,
      error: 'An internal server error occurred',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    }

    if (process.env.NODE_ENV === 'development') {
      response.details = {
        message: err.message,
        stack: err.stack
      }
    }

    return c.json(response, 500)
  }
}

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = <T = any>(
  fn: (c: Context, ...args: any[]) => Promise<T>
) => {
  return async (c: Context, ...args: any[]): Promise<T> => {
    try {
      const result = await fn(c, ...args)
      return result
    } catch (error) {
      // Re-throw known errors to be handled by global error handler
      if (error instanceof AppError) {
        throw error
      }

      // Wrap unknown errors
      throw new Error(`Route handler error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Error response creation helper
 */
export const createErrorResponse = (
  error: AppError,
  requestId?: string
): ErrorResponse => {
  return {
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    requestId
  }
}

/**
 * Common error creation helpers
 */
export const createValidationError = (
  message: string,
  code: string = 'VALIDATION_ERROR',
  details?: any
): ValidationError => {
  return new ValidationError(message, code)
}

export const createAuthenticationError = (
  message: string,
  code: string = 'AUTHENTICATION_REQUIRED'
): AuthenticationError => {
  return new AuthenticationError(message, code)
}

export const createAuthorizationError = (
  message: string,
  code: string = 'INSUFFICIENT_PERMISSIONS'
): AuthorizationError => {
  return new AuthorizationError(message, code)
}

export const createNotFoundError = (
  resource: string = 'Resource',
  code: string = 'NOT_FOUND'
): NotFoundError => {
  return new NotFoundError(`${resource} not found`, code)
}

export const createConflictError = (
  message: string,
  code: string = 'CONFLICT'
): ConflictError => {
  return new ConflictError(message, code)
}

export const createRateLimitError = (
  message: string = 'Rate limit exceeded',
  code: string = 'RATE_LIMIT_EXCEEDED'
): RateLimitError => {
  return new RateLimitError(message, code)
}

export const createDatabaseError = (
  message: string,
  originalError?: Error,
  code: string = 'DATABASE_ERROR'
): DatabaseError => {
  return new DatabaseError(message, code)
}

export const createExternalServiceError = (
  message: string,
  service: string,
  code: string = 'EXTERNAL_SERVICE_ERROR'
): ExternalServiceError => {
  return new ExternalServiceError(`${service}: ${message}`, code, 'external_service')
}

export const createFileSystemError = (
  message: string,
  code: string = 'FILESYSTEM_ERROR'
): FileSystemError => {
  return new FileSystemError(message, code)
}

/**
 * Request context middleware for error handling
 */
export const requestContextMiddleware = async (c: Context, next: Next) => {
  // Generate or extract request ID
  const requestId = c.req.header('x-request-id') ||
                   c.req.header('x-amzn-requestid') ||
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Store request context for error handling
  c.set('requestId', requestId)

  // Extract route information
  const url = new URL(c.req.url, `http://${c.req.header('host') || 'localhost'}`)
  c.set('route', `${c.req.method} ${url.pathname}`)

  await next()
}

/**
 * Error monitoring and alerting utilities
 */
export class ErrorMonitor {
  private static errors: Map<string, number> = new Map()
  private static lastAlert: Map<string, number> = new Map()
  private static readonly ERROR_THRESHOLD = 10 // 10 errors in 5 minutes
  private static readonly ALERT_COOLDOWN = 5 * 60 * 1000 // 5 minutes in milliseconds

  static recordError(errorCode: string, context?: string): void {
    const key = `${errorCode}_${context || 'default'}`
    const currentCount = this.errors.get(key) || 0
    this.errors.set(key, currentCount + 1)

    // Check if we should send an alert
    const now = Date.now()
    const lastAlertTime = this.lastAlert.get(key) || 0

    if (currentCount + 1 >= this.ERROR_THRESHOLD &&
        now - lastAlertTime > this.ALERT_COOLDOWN) {
      this.sendAlert(errorCode, context)
      this.lastAlert.set(key, now)
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      this.cleanup()
    }
  }

  private static sendAlert(errorCode: string, context?: string): void {
    const message = `High error rate detected: ${errorCode} (${context || 'unknown'})`

    logger.security('error_rate_threshold', 'high', {
      errorCode,
      context,
      threshold: this.ERROR_THRESHOLD,
      alertMessage: message
    })

    // In a real application, you might send this to:
    // - Slack channel
    // - Email notification
    // - PagerDuty
    // - External monitoring service
    console.error(`🚨 ALERT: ${message}`)
  }

  private static cleanup(): void {
    const now = Date.now()
    const fiveMinutesAgo = now - (5 * 60 * 1000)

    for (const [key] of this.errors.entries()) {
      const lastAlertTime = this.lastAlert.get(key) || 0
      if (lastAlertTime < fiveMinutesAgo) {
        this.errors.delete(key)
        this.lastAlert.delete(key)
      }
    }
  }

  static getErrorStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    for (const [key, count] of this.errors.entries()) {
      stats[key] = {
        count,
        threshold: this.ERROR_THRESHOLD,
        thresholdExceeded: count >= this.ERROR_THRESHOLD
      }
    }

    return stats
  }
}