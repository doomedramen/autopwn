/**
 * Configurable logger with log levels
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.VERBOSE]: 'VERBOSE',
};

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    // Default log level from environment, fallback to INFO
    this.currentLevel = this.getLogLevelFromEnv(process.env.LOG_LEVEL);
  }

  private getLogLevelFromEnv(envLevel?: string): LogLevel {
    if (!envLevel) {
      // Default to INFO in production, DEBUG in development
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }

    const level = envLevel.toUpperCase();
    switch (level) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'VERBOSE':
        return LogLevel.VERBOSE;
      default:
        // If invalid level, default to INFO
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const prefix = `[${timestamp}] [${levelName}]`;

    return `${prefix} ${message}`;
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message), ...args);
    }
  }

  verbose(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(this.formatMessage(LogLevel.VERBOSE, message), ...args);
    }
  }

  // Helper methods for common patterns
  api(message: string, data?: unknown): void {
    this.debug(`🌐 API: ${message}`, data);
  }

  data(message: string, data?: unknown): void {
    this.verbose(`📊 Data: ${message}`, data);
  }

  tool(message: string, data?: unknown): void {
    this.debug(`🔧 Tool: ${message}`, data);
  }

  // Get current log level
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  // Set log level (useful for runtime changes)
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  // Set log level from environment variable
  updateFromEnv(): void {
    this.currentLevel = this.getLogLevelFromEnv(process.env.LOG_LEVEL);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, ...args: unknown[]) => logger.error(message, ...args);
export const logWarn = (message: string, ...args: unknown[]) => logger.warn(message, ...args);
export const logInfo = (message: string, ...args: unknown[]) => logger.info(message, ...args);
export const logDebug = (message: string, ...args: unknown[]) => logger.debug(message, ...args);
export const logVerbose = (message: string, ...args: unknown[]) => logger.verbose(message, ...args);
export const logApi = (message: string, data?: unknown) => logger.api(message, data);
export const logData = (message: string, data?: unknown) => logger.data(message, data);
export const logTool = (message: string, data?: unknown) => logger.tool(message, data);