import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
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
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
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
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})