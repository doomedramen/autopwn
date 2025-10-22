import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/integration/**/*.test.ts', 'src/**/*.integration.test.ts'],
    exclude: [
      'src/**/__tests__/**/*.unit.test.ts',
      'src/**/*.unit.test.ts',
      'src/**/*.e2e.test.ts',
      'node_modules',
      'dist'
    ],
    globalSetup: [resolve(__dirname, 'src/test/setup/integration-global-setup.ts')],
    setupFiles: [resolve(__dirname, 'src/test/setup/integration-setup.ts')],
    testTimeout: 60000, // Longer timeout for container startup
    hookTimeout: 120000, // 2 minutes for global setup
    maxWorkers: 1, // Run integration tests sequentially to avoid port conflicts
    sequence: {
      concurrent: false
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '**/config/',
        '**/migrations/',
        '**/*.d.ts'
      ]
    },
    onConsoleLog: (log, type) => {
      // Suppress noisy container logs during tests
      if (type === 'stderr' && log.includes('POSTGRES_HOST_AUTH_METHOD')) return false
      if (type === 'stderr' && log.includes('Redis')) return false
      return true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})