import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/integration/**/*.test.{ts,tsx}', 'src/**/*.integration.test.{ts,tsx}'],
    exclude: [
      'src/**/__tests__/**/*.unit.test.{ts,tsx}',
      'src/**/*.unit.test.{ts,tsx}',
      'src/**/*.e2e.test.{ts,tsx}',
      'node_modules',
      'dist',
      '.next'
    ],
    globalSetup: [resolve(__dirname, 'src/test/setup/integration-global-setup.ts')],
    setupFiles: [resolve(__dirname, 'src/test/setup/integration-setup.ts')],
    testTimeout: 30000,
    hookTimeout: 60000,
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'src/test/',
        '**/config/',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    deps: {
      inline: ['@workspace/ui']
    }
  }
})