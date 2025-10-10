# AutoPWN Backend Tests

Comprehensive test suite for the AutoPWN backend application.

## 📊 Test Statistics

- **Total Tests:** 86 tests
- **Test Files:** 6 files
- **Execution Time:** ~1 second
- **Coverage Target:** 70%

## 🏗️ Test Structure

```
src/__tests__/
├── setup.ts                      # Global test configuration
├── mocks/                        # Mock implementations
│   ├── db.mock.ts               # Database mocks
│   ├── child-process.mock.ts   # Process mocks
│   └── fs.mock.ts               # Filesystem mocks
├── utils/                        # Test utilities
│   └── fixtures.ts              # Test data fixtures
├── unit/                         # Unit tests
│   ├── config/
│   │   └── env.test.ts          # Environment validation (19 tests)
│   ├── utils/
│   │   └── validate-tools.test.ts # Tool validation (8 tests)
│   ├── services/
│   │   ├── worker-timeout.test.ts # Worker timeout (16 tests)
│   │   └── worker-cleanup.test.ts # Job cleanup (7 tests)
│   └── routes/
│       ├── dictionaries-chunked.test.ts  # Chunked uploads (15 tests)
│       └── dictionaries-analytics.test.ts # Analytics (21 tests)
└── integration/                  # Integration tests (coming soon)
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
pnpm test

# Watch mode (auto-rerun on changes)
pnpm test:watch

# Interactive UI
pnpm test:ui

# Coverage report
pnpm test:coverage
```

### Run Specific Tests

```bash
# Run tests in a specific file
pnpm test env.test.ts

# Run tests matching pattern
pnpm test -t "environment validation"

# Run only changed tests
pnpm test --changed
```

## 📋 Test Categories

### 1. Unit Tests

**Environment Validation** (19 tests)
- Production secret validation
- Minimum length enforcement (32 chars)
- PostgreSQL connection string validation
- GPU type validation
- Job timeout configuration

**Tool Validation** (8 tests)
- hashcat installation check
- hcxpcapngtool installation check
- Version extraction
- Error handling

**Worker Service** (23 tests)
- Job timeout detection
- Process management (SIGTERM/SIGKILL)
- Orphaned job cleanup
- Job status checking

**Chunked Uploads** (15 tests)
- Metadata persistence
- Chunk storage
- Directory management
- Abandoned upload cleanup

**Dictionary Analytics** (21 tests)
- Job usage counting
- Success rate calculation
- Result aggregation

### 2. Integration Tests (Coming Soon)

- Job pause/resume/stop workflows
- Job timeout enforcement
- Chunked upload complete workflow
- API endpoint testing

### 3. E2E Tests (Frontend)

See `apps/web/e2e/` for Playwright E2E tests.

## 🛠️ Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Using Mocks

```typescript
import { createMockDb } from '../../mocks/db.mock';

const mockDb = createMockDb();

// Mock database query
vi.mocked(mockDb.select).mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([{ id: 1 }]),
  }),
});
```

### Using Fixtures

```typescript
import { testUsers, testJobs } from '../../utils/fixtures';

it('should process job', () => {
  const job = testJobs.processing;
  expect(job.status).toBe('processing');
});
```

## 📊 Coverage Requirements

### Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70,
  },
}
```

### Current Coverage

| Component | Coverage | Status |
|-----------|----------|--------|
| Environment | 92.72% | ✅ Exceeds |
| Tool Validation | 100% | ✅ Exceeds |
| Worker Service | ~30% | ⚠️ In Progress |
| Routes | 0% | ❌ Pending |
| **Overall** | **6.06%** | ⚠️ Building |

## 🧪 Mock System

### Database Mocks

```typescript
import { createMockDb, createMockJob } from '../../mocks/db.mock';

const mockDb = createMockDb();
const job = createMockJob({ status: 'processing' });
```

### Process Mocks

```typescript
import { createMockSpawn, MockChildProcess } from '../../mocks/child-process.mock';

const { spawnMock, mockProcess } = createMockSpawn();
mockProcess.emitStdout('output');
mockProcess.complete(0);
```

### Filesystem Mocks

```typescript
import { createMockFs } from '../../mocks/fs.mock';

const mockFs = createMockFs();
mockFs.__setFile('/path/to/file', 'content');
await mockFs.readFile('/path/to/file');
```

## 🎯 Test Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should calculate success rate', () => {
  // Arrange
  const totalJobs = 10;
  const successfulJobs = 7;

  // Act
  const successRate = (successfulJobs / totalJobs) * 100;

  // Assert
  expect(successRate).toBe(70);
});
```

### 2. Test One Thing

```typescript
// Good - tests one behavior
it('should reject secrets shorter than 32 characters', () => {
  expect(() => validateSecret('short')).toThrow();
});

// Avoid - tests multiple behaviors
it('should validate secrets', () => {
  expect(() => validateSecret('short')).toThrow();
  expect(() => validateSecret('weak')).toThrow();
  expect(validateSecret('good-secret')).toBe(true);
});
```

### 3. Descriptive Test Names

```typescript
// Good
it('should return 0 success rate when no jobs exist', () => {});

// Avoid
it('works', () => {});
```

### 4. Use beforeEach for Setup

```typescript
describe('Worker Service', () => {
  let worker: WorkerService;

  beforeEach(() => {
    worker = new WorkerService();
    vi.clearAllMocks();
  });

  it('should process jobs', () => {
    // Test uses fresh worker instance
  });
});
```

### 5. Test Edge Cases

```typescript
describe('Division', () => {
  it('should handle normal division', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should handle division by zero', () => {
    expect(() => divide(10, 0)).toThrow();
  });

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });
});
```

## 🔧 Debugging Tests

### Run in Debug Mode

```bash
# Run with Node debugger
node --inspect-brk ./node_modules/vitest/vitest.mjs

# Use VSCode debugger
# Add breakpoint and press F5
```

### Console Output

```typescript
it('should debug issue', () => {
  console.log('Debug value:', someValue);
  expect(someValue).toBe(expected);
});
```

### Verbose Output

```bash
# Show full error stack traces
pnpm test --reporter=verbose
```

## 📝 CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Manual workflow dispatch

See `.github/workflows/test.yml` for configuration.

## 🐛 Common Issues

### Issue: Tests Timeout

```bash
# Increase timeout for specific test
it('long running test', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Issue: Module Not Found

```bash
# Clear cache and reinstall
rm -rf node_modules
pnpm install
```

### Issue: Mock Not Working

```typescript
// Ensure mock is cleared between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Mock Service Worker](https://mswjs.io/) (for API mocking)

## 🤝 Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure tests pass locally
3. Check coverage doesn't drop below 70%
4. Update this README if adding new test categories

## 📞 Support

For issues or questions:
- Check existing tests for examples
- Review test fixtures in `utils/fixtures.ts`
- Ask in team chat or create an issue

---

**Last Updated:** 2025-10-09
**Maintained By:** AutoPWN Development Team
