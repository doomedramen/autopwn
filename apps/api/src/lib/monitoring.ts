import { logger } from './logger'
import { ErrorMonitor } from './error-handler'

/**
 * Application health and monitoring utilities
 */
export class AppMonitor {
  private static startTime: number = Date.now()
  private static readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
  private static healthCheckInterval: NodeJS.Timeout | null = null

  /**
   * Start application monitoring
   */
  static start(): void {
    logger.info('Starting application monitoring', 'system')
    this.startTime = Date.now()

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)

    // Log application startup
    logger.info('Application monitoring started', 'system', {
      startTime: new Date(this.startTime).toISOString(),
      healthCheckInterval: this.HEALTH_CHECK_INTERVAL
    })
  }

  /**
   * Stop application monitoring
   */
  static stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      logger.info('Application monitoring stopped', 'system')
    }
  }

  /**
   * Perform health check and log any issues
   */
  private static performHealthCheck(): void {
    const uptime = Date.now() - this.startTime
    const uptimeMinutes = Math.floor(uptime / 60000)
    const uptimeHours = Math.floor(uptimeMinutes / 60)
    const uptimeDays = Math.floor(uptimeHours / 24)

    // Check error rates
    const errorStats = ErrorMonitor.getErrorStats()
    const hasHighErrorRate = Object.values(errorStats).some(
      stats => stats.thresholdExceeded
    )

    // Check memory usage (basic)
    const memUsage = process.memoryUsage()
    const memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const memoryLimitMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const memoryUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

    // Log periodic health status
    const healthData = {
      uptime: {
        milliseconds: uptime,
        minutes: uptimeMinutes,
        hours: uptimeHours,
        days: uptimeDays
      },
      memory: {
        usedMB: memoryUsageMB,
        limitMB: memoryLimitMB,
        usagePercent: memoryUsagePercent
      },
      errors: errorStats
    }

    logger.debug('Health check completed', 'monitoring', healthData)

    // Alert on high error rate
    if (hasHighErrorRate) {
      logger.security('high_error_rate_detected', 'high', {
        errorStats,
        uptime: uptimeMinutes,
        memoryUsage: memoryUsagePercent
      })
    }

    // Alert on high memory usage (> 80%)
    if (memoryUsagePercent > 80) {
      logger.warn('High memory usage detected', 'monitoring', {
        memoryUsage: memoryUsagePercent,
        threshold: 80,
        memoryStats: {
          used: memoryUsageMB,
          limit: memoryLimitMB
        }
      })
    }
  }

  /**
   * Log application shutdown gracefully
   */
  static shutdown(reason: string): void {
    const uptime = Date.now() - this.startTime

    logger.info('Application shutdown initiated', 'system', {
      reason,
      uptime: Math.floor(uptime / 1000),
      timestamp: new Date().toISOString()
    })

    this.stop()

    // Log final error summary
    const finalErrorStats = ErrorMonitor.getErrorStats()
    logger.info('Final error statistics', 'system', finalErrorStats)
  }

  /**
   * Get application metrics for monitoring endpoints
   */
  static getMetrics(): {
    uptime: number
    memory: NodeJS.MemoryUsage
    errors: Record<string, any>
  } {
    const uptime = Date.now() - this.startTime
    const memUsage = process.memoryUsage()
    const errorStats = ErrorMonitor.getErrorStats()

    return {
      uptime: Math.floor(uptime / 1000),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      errors: errorStats,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Log performance metrics with context
   */
  static logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    logger.performance(operation, duration, {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      ...metadata
    })
  }

  /**
   * Log database operation performance
   */
  static logDatabasePerformance(
    operation: string,
    table?: string,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    logger.database(operation, table, duration, {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      ...metadata
    })
  }

  /**
   * Log security events with application context
   */
  static logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    const context = {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: process.memoryUsage()
    }

    logger.security(event, severity, {
      ...details,
      ...context
    })
  }
}