import { defineConfig } from 'vitest/config'

export default defineConfig({
  testEnvironment: 'node',
  resolve: {
    alias: {
      '@/test': './test',
      '@/workers': './src/workers',
      '@/lib': './lib',
      '@/config': './config',
      '@/db': './src/db',
      '@': './src'
    }
  },
  testTimeout: 30000,
  hookTimeout: 35000,
  globals: {
    NODE_ENV: 'test',
    HASHCAT_PATH: process.env.HASHCAT_PATH || 'hashcat',
    HCX_PCAPNGTOOL_PATH: process.env.HCX_PCAPNGTOOL_PATH || 'hcxpcapngtool',
    TEST_WITH_REAL_TOOLS: 'true'
  },
  setupFiles: ['src/test/setup/integration-real-setup.ts'],
  teardownTimeout: 10000,
  pool: 1,
  poolOptions: {
    isolate: true,
    threads: false
  },
  bail: 0,
  reporters: ['verbose', 'json'],
  outputFile: 'test-results/integration-real-results.json'
})