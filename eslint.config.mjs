import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'src/tests/e2e/disabled/**',
    ],
  },
  {
    rules: {
      // Disallow console methods except in specified files
      'no-console': 'error',
    },
  },
  {
    // Override for logger.ts file - allow console methods here
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console in test files
    files: ['src/tests/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console in scripts
    files: ['scripts/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console in React components (for development debugging)
    files: [
      'src/app/**/*.tsx',
      'src/components/**/*.tsx',
      'src/components/**/*.ts',
      'src/hooks/**/*.ts',
    ],
    rules: {
      'no-console': 'warn',
    },
  },
  {
    // Allow console in tools directory (external tool integrations)
    files: ['src/tools/**/*'],
    rules: {
      'no-console': 'warn',
    },
  },
  {
    // Allow console in utils directory (utility functions)
    files: ['src/utils/**/*'],
    rules: {
      'no-console': 'warn',
    },
  },
];

export default eslintConfig;
