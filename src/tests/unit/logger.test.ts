/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  logError,
  logWarn,
  logInfo,
  logDebug,
  logVerbose,
  logger,
  LogLevel,
} from '@/lib/logger';

describe('Logger', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Log Level Functions', () => {
    it('should log errors', () => {
      logError('Test error', { code: 500 });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log warnings', () => {
      logWarn('Test warning');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logInfo('Test info');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      logDebug('Test debug');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log verbose messages', () => {
      // Verbose logs may not appear depending on log level
      expect(() => logVerbose('Test verbose')).not.toThrow();
    });
  });

  describe('Log Formatting', () => {
    it('should include timestamp in logs', () => {
      logInfo('Test message');
      const logCall = consoleLogSpy.mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should include log level', () => {
      logInfo('Test message');
      const logCall = consoleLogSpy.mock.calls[0];
      const logOutput = logCall.join(' ');
      expect(logOutput).toContain('INFO');
    });

    it('should handle multiple arguments', () => {
      logInfo('Message', 'arg1', 'arg2', 123);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle objects', () => {
      const obj = { key: 'value', nested: { data: 123 } };
      logInfo('Object log', obj);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle errors', () => {
      const error = new Error('Test error');
      logError('Error occurred', error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Logger Class', () => {
    it('should have correct log level hierarchy', () => {
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.WARN);
      expect(LogLevel.WARN).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.DEBUG);
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.VERBOSE);
    });

    it('should use correct console method for each level', () => {
      logger.error('error');
      expect(consoleErrorSpy).toHaveBeenCalled();

      logger.warn('warn');
      expect(consoleWarnSpy).toHaveBeenCalled();

      logger.info('info');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values', () => {
      logInfo('Test', undefined);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle null values', () => {
      logInfo('Test', null);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle empty strings', () => {
      logInfo('');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      logInfo(longMessage);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle circular references in objects', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should not throw
      expect(() => logInfo('Circular', circular)).not.toThrow();
    });
  });

  describe('Production Behavior', () => {
    it('should check environment in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      logInfo('Production log');
      expect(consoleLogSpy).toHaveBeenCalled();

      (process.env as any).NODE_ENV = originalEnv;
    });
  });
});
