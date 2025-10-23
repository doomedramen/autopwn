import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.unit.test.ts'],
    exclude: [
      'src/**/integration/**/*.test.ts',
      'src/**/*.integration.test.ts',
      'src/**/*.e2e.test.ts',
      'node_modules',
      'dist'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/config/',
        '**/migrations/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/__tests__/**',
        '**/types/**',
        'src/index.ts', // Entry point - covered by integration tests
      ],
      // Coverage thresholds - fail build if not met
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // Per-file thresholds for critical files
      perFile: true,
      // Skip full coverage for certain file types
      skipFull: false,
      // Include all source files in coverage report, even if not tested
      all: true,
      // Watermarks for coverage visualization
      watermarks: {
        statements: [75, 90],
        functions: [75, 90],
        branches: [70, 85],
        lines: [75, 90],
      },
    },
    setupFiles: [resolve(__dirname, 'src/test/setup/unit-setup.ts')],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})