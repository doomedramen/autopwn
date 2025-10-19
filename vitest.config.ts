import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Use different environments based on test file location
    environment: 'jsdom', // Default to jsdom for React components
    environmentMatchGlobs: [
      // Use node environment for unit tests
      ['src/tests/unit/**', 'node'],
      // Use jsdom for component tests
      ['src/tests/components/**', 'jsdom'],
    ],
    include: ['src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'src/tests/e2e/**/*'],
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/tests/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        'src/lib/db/migrations/**',
        'coverage/**',
      ],
      thresholds: {
        global: {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})