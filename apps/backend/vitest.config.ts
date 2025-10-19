import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/db/migrations/',
        'src/server.ts', // Entry point, tested via integration
        'dist/',
      ],
      // Pragmatic targets - not aiming for 80%+
      lines: 50,
      functions: 50,
      branches: 40,
      statements: 50,
    },
    // Only show output for failed tests
    silent: false,
    // Run tests in parallel
    threads: true,
    // Timeout for long-running integration tests
    testTimeout: 10000,
  },
});
