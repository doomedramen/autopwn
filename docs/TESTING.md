# Testing Guide

This document provides a comprehensive overview of the testing setup for AutoPWN.

## Test Environment Overview

The test environment is isolated from development and production environments to ensure consistent and reliable test execution. This setup includes:

- Dedicated PostgreSQL database (port 5433)
- Dedicated Redis instance (port 6380)
- Test-specific environment variables with `NODE_ENV=test`
- Isolated Docker network
- Predictable superuser credentials for authentication

## Critical: NODE_ENV=test

**All e2e tests MUST run with `NODE_ENV=test`**. This ensures:

- Superuser password is set to `autopwn-test-password` (defined in apps/api/src/db/seed-superuser.ts:18)
- Test database configurations are used
- Consistent, reproducible test environment

The entire testing pipeline is configured to automatically use `NODE_ENV=test`:
- Turbo tasks pass environment variables
- pnpm scripts use `dotenv-cli` to load `.env.test`
- Playwright webServer starts services with `NODE_ENV=test`

## Environment Setup

### Configuration Files

**`.env.test`** (root and apps/web) - Contains all environment variables for testing:
```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:password@localhost:5433/autopwn_test
REDIS_URL=redis://localhost:6380
API_URL=http://localhost:3001
BASE_URL=http://localhost:3000
E2E_ADMIN_EMAIL=admin@autopwn.local
E2E_ADMIN_PASSWORD=autopwn-test-password
```

### Docker Services

The test environment uses `docker-compose.test.yml` which defines:

- `postgres-test`: PostgreSQL container on port 5433
- `redis-test`: Redis container on port 6380
- `redis-commander-test`: Redis GUI on port 8082 (optional, under 'tools' profile)

## Quick Start

### Quick Start (Development Workflow)

For iterative test development with persistent infrastructure:

```bash
# 1. Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# 2. Start test infrastructure once
pnpm test:infra:up

# 3. Run tests (fast, many times)
pnpm test

# 4. Stop infrastructure when done
pnpm test:infra:down
```

### Automated Full Lifecycle (CI/One-off runs)

For complete automated testing with setup and cleanup:

```bash
# 1. Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# 2. Run complete test lifecycle
pnpm test:full
```

The `test:full` command will:
1. ✅ Clean up any existing test infrastructure
2. ✅ Start fresh Docker containers (PostgreSQL + Redis)
3. ✅ Wait for services to be healthy
4. ✅ Run database migrations and seeding
5. ✅ Execute all e2e tests
6. ✅ Automatically clean up containers and volumes (success or failure)

### Manual Test Infrastructure Management

For more control or debugging, manage infrastructure manually:

```bash
# 1. Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# 2. Start test infrastructure
pnpm test:infra:up

# 3. Run e2e tests (Playwright starts API/web automatically with NODE_ENV=test)
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# Run in headed mode (visible browser)
pnpm test:e2e:headed

# Run only chromium tests (faster)
pnpm test:e2e:chromium

# 4. Stop test infrastructure
pnpm test:infra:down
```

### Cleanup Commands

```bash
# Clean up test infrastructure (containers + volumes + network)
pnpm test:cleanup

# Clean up ALL old test volumes (interactive, asks for confirmation)
pnpm test:cleanup:volumes
```

## Available Test Scripts

### Quick Test Commands

```bash
# Run tests (assumes infrastructure is already running)
pnpm test

# Run tests with UI
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug
```

### Full Lifecycle Test Runner

```bash
# Run complete test suite with automatic setup/cleanup
pnpm test:full

# Run tests in CI mode (preserve infrastructure on failure for debugging)
pnpm test:ci

# Run tests without any cleanup (for debugging)
pnpm test:no-cleanup
```

### Cleanup Scripts

```bash
# Clean up test infrastructure (containers, volumes, network)
pnpm test:cleanup

# Clean up ALL old/orphaned test volumes (interactive)
pnpm test:cleanup:volumes
```

### Infrastructure Management

```bash
# Start test database & redis
pnpm test:infra:up

# Stop test infrastructure (keeps volumes)
pnpm test:infra:down

# Restart infrastructure (clean slate)
pnpm test:infra:restart

# View infrastructure logs
pnpm test:infra:logs
```

### Database Management

```bash
# Run database migrations in test environment
pnpm test:db:migrate

# Push database schema changes
pnpm test:db:push

# Seed test database with superuser
pnpm test:db:seed
```

### Development Mode Testing

```bash
# Start API in test mode (for manual testing)
pnpm test:api:dev

# Start web app in test mode (for manual testing)
pnpm test:web:dev
```

### E2E Test Execution

```bash
# Run all e2e tests (requires infrastructure to be running)
pnpm test:e2e

# Run with Playwright UI
pnpm test:e2e:ui

# Run in debug mode (step through tests)
pnpm test:e2e:debug

# Run with visible browser
pnpm test:e2e:headed

# Run only chromium browser tests
pnpm test:e2e:chromium

# View test report
pnpm test:e2e:report

# Install Playwright browsers
pnpm test:e2e:install
```

## Authentication Testing

The authentication system for e2e tests follows these steps:

1. `auth.setup.ts` runs first to authenticate and store session state
2. Authentication state is saved to `playwright/.auth/user.json`
3. All subsequent tests use this stored authentication
4. No login is required for individual test cases

This approach provides:
- Faster test execution
- More reliable tests
- Better performance (tests run in parallel with shared auth state)

## Test Architecture

### Directory Structure

```
tests/
├── specs/              # Test specification files
│   ├── auth.setup.ts   # Authentication setup
│   ├── dashboard.spec.ts
│   ├── file-upload.spec.ts
│   └── basic.spec.ts
├── fixtures/           # Test fixtures
│   └── auth-fixture.ts # Authentication fixture
├── pages/              # Page Object Models
│   ├── base-page.ts
│   ├── auth-page.ts
│   └── dashboard-page.ts
├── helpers/            # Helper utilities
│   ├── auth-helper.ts
│   └── test-utils.ts
├── utils/              # Utility functions
│   ├── test-data-factory.ts
│   └── test-environment.ts
├── playwright/.auth/   # Authentication state storage
└── fixtures/           # Test data files
```

### Page Object Model

Tests follow the Page Object Model pattern:
- Each page has its own class with page-specific methods
- Common actions are abstracted in the BasePage class
- Element selectors are centralized in page classes

### Helper Functions

- `TestUtils`: Common utilities for network waiting, retries, etc.
- `AuthHelper`: Authentication-related helper functions
- `TestDataFactory`: Test data generation utilities
- `TestEnvironment`: Environment configuration utilities

## Best Practices

1. Use Page Objects for all page interactions
2. Use test utilities for complex operations
3. Use data-testid attributes for selectors when possible
4. Use explicit waits instead of arbitrary timeouts
5. Group related tests in test.describe blocks
6. Use descriptive test names
7. Clean up test data after each test when necessary
8. Always run tests in the isolated test environment

## Troubleshooting

### Common Issues

**Authentication Failures**: If the auth.setup.ts fails, check:
- Environment variables in `.env.test`
- Database connectivity
- API server status

**Port Conflicts**: If services fail to start:
- Check if ports 5433, 6380 are free
- Run `pnpm test:teardown` to stop existing services

**Docker Issues**: If Docker services don't start:
- Verify Docker is running
- Check Docker logs: `docker logs <container-name>`

### Debugging Tips

- Run tests in UI mode: `pnpm test:e2e:ui`
- Run in debug mode: `pnpm test:e2e:debug`
- Add `console.log` statements to see test execution flow
- Check the HTML report: `npx playwright show-report`
- Run individual test files: `pnpm test:e2e tests/specs/dashboard.spec.ts`

## Test Runner Architecture

### Automated Test Lifecycle

The `pnpm test` command uses a shell script (`scripts/test-runner.sh`) that manages the complete test lifecycle:

**1. Pre-Test Cleanup**
- Stops any existing test containers
- Removes test volumes for a clean slate
- Removes test network

**2. Infrastructure Setup**
- Starts PostgreSQL (port 5433) and Redis (port 6380)
- Waits for healthchecks to pass (max 60 seconds)
- Verifies services are responding

**3. Database Preparation**
- Pushes database schema with `NODE_ENV=test`
- Seeds superuser with test password

**4. Test Execution**
- Runs Playwright e2e tests
- Captures exit code (success/failure)

**5. Post-Test Cleanup**
- **On Success**: Removes containers and volumes by default
- **On Failure**: Configurable (default: cleanup, CI mode: preserve)
- Always exits with test exit code

**Configuration Options:**

```bash
# Default: cleanup on both success and failure
pnpm test

# CI mode: preserve infrastructure on failure for debugging
pnpm test:ci

# Debug mode: never cleanup (preserve for manual inspection)
pnpm test:no-cleanup
```

**Environment Variables:**
- `CLEANUP_ON_SUCCESS` - Cleanup after successful tests (default: true)
- `CLEANUP_ON_FAILURE` - Cleanup after failed tests (default: true)

### Docker Configuration Improvements

The test docker-compose configuration has been optimized for ephemeral testing:

- **`restart: "no"`** - Containers don't auto-restart (test environment is ephemeral)
- **Named volumes** - Consistent volume names for reliable cleanup
- **Named network** - Consistent network name for reliable cleanup
- **Improved healthchecks** - Faster interval (5s), more retries (10), proper start period
- **tmpfs mounts** - Faster PostgreSQL operations during tests

## How It Works: Test Pipeline Architecture

### Turbo + pnpm Integration

The testing pipeline uses turbo for task orchestration and pnpm for package management:

1. **Root `package.json`**:
   - Uses `dotenv-cli` to load `.env.test` before running turbo commands
   - Example: `dotenv -e .env.test -- turbo test:e2e`
   - This ensures all environment variables (including `NODE_ENV=test`) are available

2. **Turbo Pipeline (`turbo.json`)**:
   - Defines task dependencies and environment variable passthrough
   - E2E test tasks have `cache: false` to prevent stale results
   - Declares which env vars each task needs (NODE_ENV, DATABASE_URL, etc.)

3. **Workspace Scripts**:
   - `apps/api/package.json`: Has `test:dev`, `test:seed`, `test:migrate` with `NODE_ENV=test`
   - `apps/web/package.json`: Has `test:e2e`, `test:dev` with `NODE_ENV=test`

4. **Playwright Configuration**:
   - Automatically starts webServer with `NODE_ENV=test`
   - WebServer runs: `turbo test:dev` which starts both API and web in test mode
   - Uses `reuseExistingServer: !process.env.CI` to speed up local development

### Environment Variable Flow

```
.env.test (root)
    ↓ (loaded by dotenv-cli)
pnpm test:e2e
    ↓ (passes to turbo)
turbo test:e2e (turbo.json defines env passthrough)
    ↓ (distributed to workspaces)
apps/web: NODE_ENV=test playwright test
    ↓ (starts webServer)
Playwright webServer: NODE_ENV=test turbo test:dev
    ↓ (runs both)
apps/api: NODE_ENV=test tsx watch src/index.ts
apps/web: NODE_ENV=test next dev --turbopack
    ↓ (API seed reads NODE_ENV)
seed-superuser.ts: if (NODE_ENV === 'test') password = 'autopwn-test-password'
```

### Test Execution Flow

1. Developer runs: `pnpm test:e2e`
2. `dotenv-cli` loads `.env.test`
3. Turbo runs `test:e2e` task in apps/web workspace
4. Playwright starts (with `NODE_ENV=test`)
5. Playwright's webServer starts API + web with `NODE_ENV=test`
6. API seed creates superuser with test password
7. Tests run using stored auth or login with test credentials
8. Results are collected and reported

## CI/CD Integration

The test setup is optimized for CI/CD environments:
- Automatic retry mechanisms (configured in playwright.config.ts)
- Consistent environment setup via `NODE_ENV=test`
- Isolated test databases to prevent conflicts (port 5433)
- Proper test reporting and artifacts
- HTML reports generated for test results
- Screenshots and videos captured on failures

### CI Environment Variables

In CI, ensure these environment variables are set:
```bash
CI=true                # Triggers CI-specific behavior
NODE_ENV=test          # Forces test mode
DATABASE_URL=...       # Test database connection
REDIS_URL=...          # Test Redis connection
```

## Advanced Usage

### Running Tests Against Running Services

If you already have test services running (API + web in test mode):

```bash
# Set SKIP_WEB_SERVER to prevent Playwright from starting services
SKIP_WEB_SERVER=true pnpm test:e2e
```

### Manual Service Management

For advanced debugging, start services manually:

```bash
# Terminal 1: Start infrastructure
pnpm test:infra:up

# Terminal 2: Start API in test mode
pnpm test:api:dev

# Terminal 3: Start web in test mode
pnpm test:web:dev

# Terminal 4: Run tests (skip webServer)
cd apps/web
SKIP_WEB_SERVER=true NODE_ENV=test playwright test
```

### Debugging Individual Tests

```bash
# Run a single test file
pnpm test:e2e tests/specs/auth.spec.ts

# Run tests matching a pattern
pnpm test:e2e --grep "authentication"

# Run a specific test
pnpm test:e2e --grep "should protect authenticated routes"
```