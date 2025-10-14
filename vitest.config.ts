import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'src/tests/e2e/**/*'],
    // Add test suites for different purposes
    testNamePattern: undefined, // Run all tests by default
    coverage: {
      provider: 'v8', // Use v8 provider for faster coverage
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