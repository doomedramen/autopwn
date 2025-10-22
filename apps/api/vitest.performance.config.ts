import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/performance/**/*.test.ts', 'src/**/*.performance.test.ts'],
    exclude: [
      'src/**/*.unit.test.ts',
      'src/**/*.integration.test.ts',
      'src/**/*.e2e.test.ts',
      'node_modules',
      'dist'
    ],
    setupFiles: [resolve(__dirname, 'src/test/setup/performance-setup.ts')],
    testTimeout: 300000, // 5 minutes for performance tests
    hookTimeout: 180000, // 3 minutes setup
    maxWorkers: 1,
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/performance-results.json'
    },
    benchmark: {
      include: ['src/**/performance/**/*.bench.ts', 'src/**/*.bench.ts'],
      exclude: ['node_modules', 'dist'],
      outputFile: './test-results/benchmark-results.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})