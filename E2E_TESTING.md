# E2E Testing Guide

## Overview

AutoPWN uses Playwright for comprehensive end-to-end testing. The E2E test suite covers all major functionality including authentication, user management, file uploads, job execution, and administrative features.

## Test Architecture

### Fixed Issues ✅

The E2E test suite has been optimized to eliminate:

- **Test state pollution**: Individual tests now run in isolated environments
- **Parallel execution interference**: Reduced to single worker for reliability
- **Server resource conflicts**: Proper server lifecycle management
- **Memory exhaustion**: Optimized memory limits and cleanup
- **Timeout issues**: Eliminated 30+ second timeouts through better isolation

### Test Structure

```
apps/web/tests/
├── fixtures/
│   └── auth-fixture.ts     # Authentication setup
├── specs/                  # Test suites
│   ├── auth-flow.spec.ts   # Authentication flows
│   ├── user-management*.spec.ts # User CRUD operations
│   ├── dashboard.spec.ts   # Main dashboard functionality
│   ├── file-upload.spec.ts # File upload workflows
│   ├── upload-jobs.spec.ts # Job creation and execution
│   ├── data-management.spec.ts # Data handling
│   └── [other test suites]
├── auth.setup.ts           # Global authentication setup
├── global-setup.ts         # Database and environment setup
└── global-teardown.ts      # Cleanup and resource management
```

## Running Tests

### Method 1: Managed E2E Tests (Recommended)

The managed E2E script handles server lifecycle automatically:

```bash
# Run all E2E tests
pnpm test:e2e:managed

# Run specific browser tests
pnpm test:e2e:managed:chromium

# Custom options
./scripts/test-e2e.sh -p chromium  # Specific project
./scripts/test-e2e.sh -c           # Cleanup only
./scripts/test-e2e.sh -h           # Show help
```

### Method 2: Manual Server Management

For development scenarios where you want to manage servers manually:

```bash
# Terminal 1: Start API server
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test" \
NODE_ENV=test \
pnpm --filter @autopwn/api test:dev

# Terminal 2: Start Web server
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test" \
NODE_ENV=test \
BASE_URL="http://localhost:3000" \
pnpm --filter web test:dev

# Terminal 3: Run tests
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test" \
SKIP_WEB_SERVER=true \
NODE_ENV=test \
BASE_URL="http://localhost:3000" \
pnpm test:e2e -- tests/specs/user-management.spec.ts
```

### Method 3: Legacy Command

The original command still works but requires manual server setup:

```bash
# Requires servers to be running manually
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test" \
SKIP_WEB_SERVER=true \
NODE_ENV=test \
BASE_URL="http://localhost:3000" \
pnpm test:e2e
```

## Environment Configuration

Tests use `.env.test.local` for configuration:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test"

# Test Credentials
E2E_ADMIN_EMAIL="admin@autopwn.local"
E2E_ADMIN_PASSWORD="admin123"

# Server URLs
BASE_URL="http://localhost:3000"
API_URL="http://localhost:3001"

# Environment
NODE_ENV="test"
SKIP_WEB_SERVER="true"
```

## Test Coverage

### ✅ Completed Phases (100% Success Rate)

- **Phase 3**: User Management CRUD Operations (11/11 tests)
- **Phase 4**: Administrative Functions (13/13 tests)
- **Phase 5**: Dictionary Management (12/12 tests)
- **Phase 6**: Data Management (19/19 tests)
- **Phase 7**: Advanced Features (14/14 tests)
- **Phase 8**: Error Handling (13/13 tests)

### 🔄 Authentication Tests

Authentication flows are functional but require server isolation:
- User registration and login flows
- Protected route handling
- Form validation and error states
- Responsive design testing

## Troubleshooting

### Cleanup Stuck Processes

If tests hang or processes get stuck:

```bash
# Cleanup script
./scripts/test-e2e.sh -c

# Manual cleanup
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null
pkill -f "test:dev|next dev|playwright test" 2>/dev/null
```

### Common Issues

1. **Connection Refused**: Servers not running - use managed test script
2. **Timeout Issues**: Usually resource conflicts - cleanup processes
3. **Database Errors**: Check DATABASE_URL and database connectivity
4. **Auth Failures**: Verify test superuser creation in global setup

### Debug Mode

For debugging test failures:

```bash
# Run specific test with debugging
DATABASE_URL="..." SKIP_WEB_SERVER=true NODE_ENV=test pnpm test:e2e -- tests/specs/auth-flow.spec.ts --grep "test name" --debug

# Run with headed browser
pnpm test:e2e:headed -- tests/specs/auth-flow.spec.ts
```

## Best Practices

1. **Use managed tests**: `pnpm test:e2e:managed` for reliable execution
2. **Single worker**: Tests run with single worker to prevent resource conflicts
3. **Environment isolation**: Each test run gets clean database and server state
4. **Automatic cleanup**: Global teardown ensures no resource leakage
5. **Memory limits**: Optimized settings prevent memory exhaustion

## Contributing

When adding new E2E tests:

1. Use the existing fixtures and patterns
2. Add proper `data-testid` attributes to components
3. Include responsive design testing where applicable
4. Test both happy path and error scenarios
5. Ensure tests work in isolation
6. Add cleanup for any resources created during tests

The test infrastructure is designed to prevent state pollution and provide reliable, consistent test execution across all environments.