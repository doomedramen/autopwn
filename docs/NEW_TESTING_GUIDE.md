# Comprehensive Testing Guide for AutoPWN

This guide covers the new, modern testing setup for the AutoPWN security testing platform.

## 🚀 What's New

- **✅ Testcontainers Integration**: Replaced Docker Compose for better test isolation
- **✅ Vitest Framework**: Fast, modern testing with TypeScript support
- **✅ Comprehensive Mocking**: Security-focused test harness
- **✅ Performance Testing**: Built-in benchmarking and load testing
- **✅ Multi-Browser E2E**: Chromium, Firefox, and WebKit support
- **✅ CI/CD Pipeline**: Automated GitHub Actions workflows
- **✅ Developer Experience**: Watch mode, UI debugging, and better DX

## Overview

AutoPWN uses a modern, multi-layered testing approach:

- **Unit Tests** (70%) - Fast, isolated tests for individual functions and components
- **Integration Tests** (20%) - Tests that verify interaction between modules using Testcontainers
- **E2E Tests** (10%) - Full application workflow testing with real browsers
- **Performance Tests** - Load testing and benchmarking
- **Security Tests** - Specialized tests for security features with mocked hashcat

## Quick Start

### Running All Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run end-to-end tests
pnpm test:e2e

# Run with coverage
pnpm test:coverage

# Watch mode for development
pnpm test:watch
```

### API Testing

```bash
# Run API unit tests
pnpm test:unit --filter @autopwn/api

# Run API integration tests (with Testcontainers)
pnpm test:integration --filter @autopwn/api

# Run API performance tests
pnpm test:performance --filter @autopwn/api

# Run specific test file
pnpm test:unit --filter @autopwn/api auth-client.test.ts
```

### Web App Testing

```bash
# Run web app unit tests
pnpm test:unit --filter web

# Run web app integration tests
pnpm test:integration --filter web

# Run E2E tests with Playwright
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Debug E2E tests
pnpm test:e2e:debug
```

## Test Architecture

### Unit Testing with Vitest

- **Framework**: Vitest with TypeScript support
- **Environment**: `jsdom` for web, `node` for API
- **Mocking**: Comprehensive mocking of external dependencies
- **Coverage**: V8 coverage provider with HTML reports

#### Configuration Files
- `vitest.unit.config.ts` - Unit test configuration
- `vitest.integration.config.ts` - Integration test configuration
- `vitest.performance.config.ts` - Performance test configuration

### Integration Testing with Testcontainers

- **Database**: PostgreSQL 15 in Docker containers
- **Cache**: Redis 7 in Docker containers
- **Lifecycle**: Automatic container management with cleanup
- **Performance**: Optimized for CI/CD execution

#### Testcontainers Benefits
- ✅ **Automatic Setup**: No manual Docker management
- ✅ **Parallel Execution**: Multiple test suites can run in parallel
- ✅ **Isolation**: Each test gets a clean environment
- ✅ **CI/CD Ready**: Works seamlessly in GitHub Actions

### E2E Testing with Playwright

- **Browsers**: Chromium, Firefox, WebKit for cross-browser testing
- **Parallelism**: Configurable workers for fast execution (4 workers local, 2 workers CI)
- **Debugging**: Traces, screenshots, and video on failure
- **Authentication**: Persistent auth state across tests using fixtures

#### Improved Configuration
- ✅ **Removed Memory Constraints**: Increased from 512MB to 2048MB
- ✅ **Multi-Browser Support**: Tests now run on Chrome, Firefox, and Safari
- ✅ **Better Debugging**: Traces and video retained on failure
- ✅ **Optimized Timeouts**: Increased from 10s to 30s for reliability

### Performance Testing

- **Benchmarks**: Vitest benchmark integration
- **Load Testing**: k6 for realistic load simulation
- **Memory Profiling**: Node.js memory usage tracking
- **Regression Detection**: Automated performance comparison

## Test Data Management

### TestDataFactory

Comprehensive test data generation with realistic security testing scenarios:

```typescript
import { TestDataFactory } from '@/test/utils/test-data-factory'

// Generate test users
const user = TestDataFactory.createUser()
const admin = TestDataFactory.createAdminUser()

// Generate test jobs
const job = TestDataFactory.createJob({
  type: 'wordlist',
  status: 'running'
})

// Generate network captures
const capture = TestDataFactory.createNetworkCapture({
  networks: [
    {
      ssid: 'TestNetwork',
      bssid: '00:11:22:33:44:55',
      encryption: 'WPA2'
    }
  ]
})
```

### Security Test Harness

Specialized mocking for hashcat and security operations:

```typescript
import { createTestHashcatScenario } from '@/test/mocks/hashcat-mock'

// Test successful cracking scenario
const successMocks = await createTestHashcatScenario('success')

// Test failure scenarios
const failureMocks = await createTestHashcatScenario('failure')

// Test timeout scenarios
const timeoutMocks = await createTestHashcatScenario('timeout')
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest'
import { runHashcatAttack } from '@/workers/hashcat'

describe('Hashcat Worker', () => {
  it('should execute hashcat attack successfully', async () => {
    const result = await runHashcatAttack({
      jobId: 'test-job',
      attackMode: 'handshake',
      // ... other params
    })

    expect(result.success).toBe(true)
    expect(result.passwordsFound).toBeGreaterThanOrEqual(0)
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb, createTestJob } from '@/test/utils/test-utils'

describe('Job Processing Integration', () => {
  beforeAll(async () => {
    // Testcontainers automatically set up test environment
  })

  it('should process job through complete workflow', async () => {
    const job = await createTestJob(jobData)

    // Test actual workflow
    const result = await processJob(job.id)

    expect(result.status).toBe('completed')
  })
})
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test.describe('Security Testing Workflow', () => {
  test('should complete password cracking workflow', async ({ page }) => {
    await page.goto('/')

    // Upload network capture
    await page.click('[data-testid="upload-capture"]')
    await page.setInputFiles('input[type="file"]', 'test.pcap')
    await page.click('[data-testid="upload-submit"]')

    // Configure and run attack
    await page.click('[data-testid="configure-attack"]')
    await page.selectOption('[data-testid="dictionary-select"]', 'rockyou.txt')
    await page.click('[data-testid="start-attack"]')

    // Verify results
    await expect(page.locator('[data-testid="results-section"]')).toBeVisible()
  })
})
```

### Performance Test Example

```typescript
import { describe, it, expect, benchmark } from 'vitest'

describe('Hashcat Performance', () => {
  it('should process dictionary efficiently', async () => {
    const stats = await benchmark('dictionary-processing', async () => {
      return await processDictionary('test-dict.txt')
    }, 100)

    expect(stats.avg).toBeLessThan(1000) // 1 second average
    expect(stats.p95).toBeLessThan(2000) // 2 second P95
  })
})
```

## Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Test databases (Testcontainers automatically sets these)
DATABASE_URL=postgresql://test:test@localhost:5432/test
REDIS_URL=redis://localhost:6379

# E2E test credentials
E2E_ADMIN_EMAIL=admin@autopwn.local
E2E_ADMIN_PASSWORD=test-password

# API endpoints
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001
```

### Testcontainers Configuration

Testcontainers automatically manages test databases:

```typescript
// Integration test setup automatically:
// - Starts PostgreSQL 15
// - Starts Redis 7
// - Runs migrations
// - Cleans up after tests
```

### Playwright Configuration

- **Multiple browsers**: Chromium, Firefox, WebKit testing
- **Parallel execution**: Configurable worker count
- **Debugging**: Traces and video on failure
- **Authentication**: Persistent auth state via fixtures

## CI/CD Integration

### GitHub Actions

Automated testing pipeline with comprehensive workflows:

#### Main Test Workflow (`.github/workflows/test.yml`)
1. **Lint & Type Check**: Code quality verification
2. **Unit Tests**: Fast feedback on all changes
3. **Integration Tests**: Full dependency testing with Testcontainers
4. **E2E Tests**: Real browser automation
5. **Security Tests**: Audit and specialized testing
6. **Performance Tests**: Benchmarks and load testing

#### Deployment Workflow (`.github/workflows/deploy.yml`)
1. **Build and Test**: Comprehensive pre-deployment verification
2. **Security Scanning**: CodeQL analysis and vulnerability audit
3. **Multi-Stage Deployment**: API and web app deployment
4. **Health Checks**: Post-deployment verification
5. **Failure Notification**: Issue creation for deployment failures

#### Performance Workflow (`.github/workflows/performance.yml`)
1. **Daily Benchmarks**: Automated performance tracking
2. **Load Testing**: k6-based load simulation
3. **Memory Profiling**: Node.js memory usage analysis
4. **Regression Detection**: Comparison with historical data

### Test Results

- **Coverage Reports**: Uploaded to Codecov for coverage tracking
- **Test Reports**: HTML reports in GitHub Actions artifacts
- **Performance Metrics**: Artifact storage and dashboard updates
- **Failure Artifacts**: Screenshots and traces for debugging
- **Security Scans**: CodeQL and vulnerability reports

## Best Practices

### Test Organization

```
apps/api/src/
├── __tests__/           # Unit tests
├── integration/          # Integration tests
├── test/               # Test utilities
│   ├── setup/          # Test configuration
│   ├── utils/          # Helper functions
│   ├── mocks/          # Mock implementations
│   └── fixtures/       # Test data

apps/web/src/
├── __tests__/           # Unit tests
├── integration/          # Integration tests
├── test/               # Test utilities
│   ├── setup/          # Test configuration
│   ├── utils/          # Helper functions
│   └── mocks/          # Mock implementations
```

### Security Testing Guidelines

1. **Isolated Testing**: Use dedicated test environments
2. **Mock Security Tools**: Don't run real hashcat in CI (use test harness)
3. **Data Sanitization**: Never use real passwords in tests
4. **Permission Testing**: Verify access controls work correctly

### Performance Testing Guidelines

1. **Baseline Metrics**: Establish performance baselines
2. **Regression Detection**: Compare with previous runs
3. **Resource Limits**: Test with realistic constraints
4. **Load Scenarios**: Simulate real usage patterns

### Debugging Tests

#### Unit Tests

```bash
# Debug specific test
pnpm test:unit --filter api auth-client.test.ts --reporter=verbose

# Run tests in watch mode
pnpm test:watch
```

#### Integration Tests

```bash
# Keep containers running for debugging
KEEP_CONTAINERS=true pnpm test:integration

# Connect to test database (if needed)
psql -h localhost -p 5432 -U test -d test
```

#### E2E Tests

```bash
# Run with debugging UI
pnpm test:e2e:ui

# Run with headed mode (visible browser)
pnpm test:e2e:headed

# Run with debugging
pnpm test:e2e:debug

# Run specific test
pnpm test:e2e tests/specs/auth.spec.ts
```

## Comparison: Old vs New Testing Setup

### Before (Docker Compose)
- ❌ Manual container management
- ❌ Sequential test execution
- ❌ Memory constraints (512MB)
- ❌ Single browser testing
- ❌ Complex cleanup scripts
- ❌ No performance testing
- ❌ Limited CI/CD integration

### After (Testcontainers + Vitest)
- ✅ Automatic container lifecycle
- ✅ Parallel test execution
- ✅ No memory constraints (2048MB)
- ✅ Multi-browser testing
- ✅ Automatic cleanup
- ✅ Built-in performance testing
- ✅ Comprehensive CI/CD pipeline
- ✅ Better developer experience

## Migration Guide

### From Docker Compose to Testcontainers

1. **Install Dependencies**: `pnpm install` (already done)
2. **Update Scripts**: Use new `pnpm test:*` commands
3. **Remove Old Scripts**: No longer need `test-runner.sh`
4. **Update CI**: Use GitHub Actions workflows (already created)

### Test Execution Differences

```bash
# Old way
bash ./scripts/test-runner.sh

# New way
pnpm test
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Testcontainers manages ports automatically
2. **Memory Limits**: Adjust `NODE_OPTIONS` if needed (now 2048MB by default)
3. **Container Timeouts**: Increase health check timeouts in configuration
4. **Browser Issues**: Update Playwright browsers with `pnpm test:e2e:install`
5. **Testcontainers Issues**: Ensure Docker is running and permissions are correct

### Getting Help

- Check test logs in GitHub Actions
- Review performance dashboards
- Use debugging modes for failing tests
- Check test coverage reports for gaps
- Use `pnpm test:ui` for interactive test debugging

## Mock Data Reference

### Network Captures

Realistic test data for different scenarios:

```typescript
// WPA2 with handshake
const wpa2Capture = TestDataFactory.createNetworkCapture({
  networks: [{
    ssid: 'TestNetwork',
    encryption: 'WPA2',
    hasHandshake: true,
    signalStrength: -45
  }]
})

// WPA3 with PMKID
const wpa3Capture = TestDataFactory.createNetworkCapture({
  networks: [{
    ssid: 'TestNetwork5G',
    encryption: 'WPA3',
    hasPmkid: true,
    frequency: 5180
  }]
})
```

### Job Configurations

Test different attack scenarios:

```typescript
// Dictionary attack
const dictAttack = TestDataFactory.createJob({
  type: 'wordlist',
  dictionaryFile: 'rockyou.txt'
})

// Mask attack
const maskAttack = TestDataFactory.createJob({
  type: 'mask',
  mask: '?d?d?d?d'
})

// Hybrid attack
const hybridAttack = TestDataFactory.createJob({
  type: 'hybrid',
  dictionaryFile: 'rockyou.txt',
  mask: '?d?d?d'
})
```

This comprehensive testing setup ensures AutoPWN delivers reliable security testing capabilities while maintaining high code quality and performance standards.