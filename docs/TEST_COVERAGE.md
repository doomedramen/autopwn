# Test Coverage Guide

This document explains the test coverage strategy and requirements for AutoPWN.

## Coverage Requirements

AutoPWN enforces minimum code coverage thresholds to ensure code quality and reliability:

### Minimum Thresholds (Unit Tests)

| Metric | Threshold | Description |
|--------|-----------|-------------|
| **Lines** | 80% | Percentage of lines executed |
| **Functions** | 80% | Percentage of functions called |
| **Branches** | 75% | Percentage of branches (if/else) executed |
| **Statements** | 80% | Percentage of statements executed |

### Coverage Watermarks

Visual indicators in coverage reports:

- **🔴 Red** (Below threshold): < 75% for most metrics, < 70% for branches
- **🟡 Yellow** (Warning): 75-90% for most metrics, 70-85% for branches
- **🟢 Green** (Good): > 90% for most metrics, > 85% for branches

## Running Coverage Tests

### Unit Test Coverage

```bash
# Run unit tests with coverage
pnpm test:coverage

# Run and open HTML report
pnpm test:coverage:report

# Run all tests with coverage
pnpm test:coverage:all
```

### Coverage Reports

Coverage reports are generated in multiple formats:

```
coverage/
├── index.html          # Interactive HTML report
├── lcov.info           # LCOV format (for CI tools)
├── coverage-final.json # JSON format
└── lcov-report/        # Detailed HTML reports
```

### Viewing Coverage Reports

#### HTML Report

```bash
# Generate and open coverage report
pnpm test:coverage:report

# Or manually open
open coverage/index.html
```

#### Terminal Report

Coverage summary is automatically displayed after running tests:

```
 % Coverage report from v8
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |   85.23 |    78.45 |   82.14 |   85.23 |
 middleware           |   92.45 |    85.71 |   90.00 |   92.45 |
  auth.ts             |   95.00 |    88.88 |   92.30 |   95.00 | 45-47
  rateLimit.ts        |   90.00 |    82.14 |   87.50 |   90.00 | 112-115,145
 routes               |   88.12 |    76.92 |   85.71 |   88.12 |
  users.ts            |   92.00 |    80.00 |   90.00 |   92.00 | 67-70
----------------------|---------|----------|---------|---------|-------------------
```

## Coverage Exclusions

The following files/directories are excluded from coverage requirements:

### Automatically Excluded

- `node_modules/` - Third-party dependencies
- `dist/` - Compiled output
- `**/*.d.ts` - TypeScript type definitions
- `**/*.config.*` - Configuration files
- `**/config/` - Configuration directory
- `**/migrations/` - Database migrations
- `**/test/**` - Test utilities
- `**/__tests__/**` - Test files themselves
- `**/types/**` - Type definitions

### Entry Points

- `src/index.ts` - Server entry point (covered by integration tests)

### Why These Exclusions?

- **Configuration files**: Simple data, no logic to test
- **Migrations**: Database schema changes, tested via integration tests
- **Type definitions**: No runtime behavior
- **Test files**: Testing the tests is redundant

## Coverage by Test Type

### Unit Tests (Primary Coverage Source)

- **Target**: Business logic, utilities, middleware
- **Coverage Goal**: 80%+
- **Fast**: < 1 second per test suite
- **Isolation**: Mocked dependencies

### Integration Tests (Supplementary Coverage)

- **Target**: API endpoints, database interactions
- **Coverage Goal**: Validate critical paths
- **Slower**: 5-30 seconds per test suite
- **Real Dependencies**: Testcontainers for DB/Redis

### E2E Tests (User Flow Coverage)

- **Target**: Complete user workflows
- **Coverage Goal**: Happy paths + critical error paths
- **Slowest**: 30+ seconds per suite
- **Real Environment**: Playwright with real browser

## Writing Tests for Coverage

### Good Coverage Practices

#### ✅ Test All Code Paths

```typescript
// Function to test
function calculateDiscount(price: number, userType: string): number {
  if (userType === 'premium') {
    return price * 0.8  // 20% discount
  } else if (userType === 'regular') {
    return price * 0.9  // 10% discount
  }
  return price  // No discount
}

// Tests covering all branches
it('should give 20% discount to premium users', () => {
  expect(calculateDiscount(100, 'premium')).toBe(80)
})

it('should give 10% discount to regular users', () => {
  expect(calculateDiscount(100, 'regular')).toBe(90)
})

it('should give no discount to unknown user types', () => {
  expect(calculateDiscount(100, 'guest')).toBe(100)
})
```

#### ✅ Test Error Conditions

```typescript
it('should handle network errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'))

  await expect(fetchUserData('123')).rejects.toThrow('Network error')
})
```

#### ✅ Test Edge Cases

```typescript
it('should handle empty arrays', () => {
  expect(sum([])).toBe(0)
})

it('should handle null values', () => {
  expect(formatName(null)).toBe('Unknown')
})
```

### Coverage Anti-Patterns

#### ❌ Don't Test Implementation Details

```typescript
// BAD: Testing internal implementation
it('should call internal helper function', () => {
  const spy = jest.spyOn(module, '_internalHelper')
  module.publicFunction()
  expect(spy).toHaveBeenCalled()
})

// GOOD: Test public behavior
it('should return correct result', () => {
  expect(module.publicFunction()).toBe(expectedResult)
})
```

#### ❌ Don't Write Tests Just for Coverage

```typescript
// BAD: Meaningless test
it('should exist', () => {
  expect(myFunction).toBeDefined()
})

// GOOD: Test actual behavior
it('should validate email format correctly', () => {
  expect(validateEmail('test@example.com')).toBe(true)
  expect(validateEmail('invalid')).toBe(false)
})
```

## CI/CD Integration

### GitHub Actions

Coverage is automatically checked in CI:

```yaml
- name: Run tests with coverage
  run: pnpm test:coverage

- name: Check coverage thresholds
  run: |
    if [ -f coverage/coverage-summary.json ]; then
      echo "Coverage report generated successfully"
    else
      echo "Coverage report missing!"
      exit 1
    fi
```

### Build Failure on Low Coverage

If coverage falls below thresholds, the build fails:

```
ERROR: Coverage for lines (78.5%) does not meet global threshold (80%)
ERROR: Coverage for statements (79.2%) does not meet global threshold (80%)

Build failed due to insufficient test coverage.
```

## Improving Coverage

### 1. Identify Uncovered Code

```bash
# Run coverage and open report
pnpm test:coverage:report

# Look for red/yellow highlighted code in HTML report
# Or check terminal output for uncovered line numbers
```

### 2. Write Missing Tests

Focus on:
- Uncovered branches (if/else, switch cases)
- Error handling paths
- Edge cases
- Validation logic

### 3. Verify Coverage Improvement

```bash
# Run coverage again
pnpm test:coverage

# Check if metrics improved
```

## Coverage Goals by Component

### Critical Components (90%+ coverage required)

- **Authentication** (`middleware/auth.ts`)
  - Security-critical, must be thoroughly tested
- **Security Middleware** (`middleware/security.ts`)
  - Rate limiting, CORS, input validation
- **Database Operations** (`db/`)
  - Data integrity is critical

### Important Components (80%+ coverage required)

- **API Routes** (`routes/`)
  - Business logic, request/response handling
- **Workers** (`workers/`)
  - Background job processing
- **Utilities** (`lib/`)
  - Shared helper functions

### Lower Priority (70%+ coverage acceptable)

- **Configuration** (`config/`)
  - Simple data structures
- **Types** (`types/`)
  - TypeScript definitions

## Troubleshooting

### Coverage Not Updating

```bash
# Clear coverage cache
rm -rf coverage/

# Run tests fresh
pnpm test:coverage
```

### False Positives in Coverage

Some code may appear uncovered but is actually tested:

- Dynamic imports
- Lazy-loaded modules
- Code executed in child processes

**Solution**: Add `/* istanbul ignore next */` comment for legitimately untestable code:

```typescript
/* istanbul ignore next */
if (process.env.NODE_ENV === 'production') {
  // Production-only code
}
```

### Coverage Slowing Down Tests

Coverage adds overhead. For fast development:

```bash
# Run tests without coverage during development
pnpm test:watch

# Run coverage only before commits/PR
pnpm test:coverage
```

## Best Practices

### 1. Run Coverage Locally Before Pushing

```bash
pnpm test:coverage
```

### 2. Review Coverage Reports

Don't just look at percentages - review the HTML report to understand **what** isn't covered.

### 3. Maintain Coverage Over Time

- Add tests for new features **before** merging
- Never decrease coverage thresholds
- Fix coverage drops immediately

### 4. Use Coverage as a Guide, Not a Goal

- 100% coverage doesn't mean bug-free code
- Focus on testing **behavior**, not lines
- Quality > Quantity

## Coverage Metrics Explained

### Line Coverage

Percentage of code lines executed during tests.

```typescript
function example(x: number) {
  if (x > 0) {
    return 'positive'  // Line 1
  }
  return 'non-positive'  // Line 2
}

// Test only positive case = 50% line coverage
// Test both cases = 100% line coverage
```

### Branch Coverage

Percentage of code branches (if/else, switch, ternary) executed.

```typescript
const result = x > 0 ? 'positive' : 'negative'
// Need tests for both x > 0 and x <= 0 for 100% branch coverage
```

### Function Coverage

Percentage of functions called during tests.

```typescript
function helper() { /* ... */ }
function main() { helper() }

// Calling main() gives 100% function coverage
```

### Statement Coverage

Similar to line coverage but counts JavaScript statements.

```typescript
const a = 1; const b = 2  // 2 statements on 1 line
```

## Resources

- [Vitest Coverage Docs](https://vitest.dev/guide/coverage.html)
- [V8 Coverage Provider](https://v8.dev/blog/javascript-code-coverage)
- [Istanbul Coverage](https://istanbul.js.org/)

---

**Last Updated:** 2025-10-24
