import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.unit.test.{ts,tsx}'],
    exclude: [
      'src/**/*.integration.test.{ts,tsx}',
      'src/**/*.e2e.test.{ts,tsx}',
      'node_modules',
      'dist',
      '.next'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/test-utils/**'
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