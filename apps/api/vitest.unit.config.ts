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
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/config/',
        '**/migrations/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
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