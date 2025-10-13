import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    // Add test suites for different purposes
    testNamePattern: undefined, // Run all tests by default
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})