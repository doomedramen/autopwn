# E2E Tests

This directory contains end-to-end tests for the AutoPWN application using Playwright.

## Setup

1. Install Playwright browsers:
   ```bash
   pnpm test:e2e:install
   ```

2. Set up the test environment:
   ```bash
   # Start test-specific services (PostgreSQL on 5433, Redis on 6380)
   pnpm test:setup
   ```

3. The tests will automatically use the `.env.test` file for configuration.

## Running Tests

- Run all tests: `pnpm test:e2e`
- Run tests with UI: `pnpm test:e2e:ui`
- Run tests in debug mode: `pnpm test:e2e:debug`
- Run specific test file: `pnpm test:e2e tests/specs/dashboard.spec.ts`
- Tear down test environment: `pnpm test:teardown`

## Test Environment

The tests run against a dedicated test environment that is isolated from development and production:

- **Database**: PostgreSQL on port 5433 (separate from dev DB on 5432)
- **Redis**: Redis on port 6380 (separate from dev Redis on 6379) 
- **Environment**: Uses `.env.test` file with test-specific configurations
- **Authentication**: Dedicated test credentials

## Test Structure

The test suite follows the Page Object Model pattern and is organized as follows:

- `specs/` - Test specification files (end-to-end tests)
  - `auth.setup.ts` - Authentication setup (runs first to store session)
  - `dashboard.spec.ts` - Dashboard functionality tests
  - `file-upload.spec.ts` - File upload functionality tests
  - `basic.spec.ts` - Basic functionality tests
- `fixtures/` - Test fixtures and helper files
  - `auth-fixture.ts` - Authentication fixture for importing in tests
- `pages/` - Page Object Models
  - `base-page.ts` - Base page class with common methods
  - `auth-page.ts` - Authentication page elements and methods
  - `dashboard-page.ts` - Dashboard page elements and methods
- `helpers/` - Helper classes and functions
  - `auth-helper.ts` - Authentication-related helper functions
  - `test-utils.ts` - Common test utilities
- `utils/` - Test utilities
  - `test-data-factory.ts` - Test data generation utilities
  - `test-environment.ts` - Test environment configuration
- `fixtures/` - Test data files (for file upload tests, etc.)
- `playwright/.auth/` - Storage location for authentication state

## Authentication System

The authentication system works as follows:

1. `auth.setup.ts` runs first and authenticates the user
2. Authentication state (cookies, localStorage, etc.) is saved to `playwright/.auth/user.json`
3. All other tests use this stored authentication state
4. This means subsequent tests don't need to log in again

This approach provides:
- Faster test execution (no repeated authentication)
- More reliable tests (no login flakiness affecting other tests)
- Better performance (tests run in parallel with shared auth state)

## Key Features

### Page Object Model
Tests use the Page Object Model pattern for better maintainability:
- Each page has its own class with page-specific methods
- Common actions are abstracted in the BasePage class
- Element selectors are centralized in page classes

### Shared Authentication
- Authentication happens once before other tests
- Authentication state is shared across all tests
- No need to log in for each individual test

### Test Data Management
- Centralized test data generation using TestDataFactory
- Environment-specific configurations in TestEnvironment
- Support for custom and randomized test data

### Helper Utilities
- Common test utilities for complex operations
- Network request waiting functions
- Retry mechanisms for flaky tests
- Screenshot utilities with timestamps

## Writing New Tests

1. Create your test file in the `specs/` directory
2. Import from `../fixtures/auth-fixture` to get page with stored authentication
3. Use Page Objects for element interactions when possible
4. Use helper functions from the helpers directory for common operations
5. Follow the existing patterns for selectors and assertions

Example:
```typescript
import { test, expect } from '../fixtures/auth-fixture';
import { DashboardPage } from '../pages/dashboard-page';

test('my test', async ({ page }) => {
  const dashboardPage = new DashboardPage(page);
  
  await dashboardPage.navigate('/my-page');
  await expect(dashboardPage.getByText('Expected Text')).toBeVisible();
});
```

## Environment Variables

The tests automatically load variables from `.env.test`, which includes:
- `E2E_ADMIN_EMAIL` - Admin email for authentication (default: admin@autopwn.local)
- `E2E_ADMIN_PASSWORD` - Admin password for authentication 
- `BASE_URL` - Base URL for the application (default: http://localhost:3000)
- `DATABASE_URL` - Test database connection string
- `REDIS_URL` - Test Redis connection string
- `CI` - Set to any value when running in CI environment (affects timeouts and retries)

## Best Practices

1. Always run `pnpm test:setup` before running tests
2. Always run `pnpm test:teardown` after tests are complete
3. Use Page Objects for all page interactions
4. Use test utilities for complex operations
5. Use data-testid attributes for selectors when possible
6. Use explicit waits instead of arbitrary timeouts
7. Group related tests in test.describe blocks
8. Use descriptive test names
9. Clean up test data after each test when necessary

## Debugging Tips

- Run tests in UI mode: `pnpm test:e2e:ui`
- Run in debug mode: `pnpm test:e2e:debug`
- Add `console.log` statements to see test execution flow
- Check the HTML report after test runs: `npx playwright show-report`
- Use VSCode extension for step-by-step debugging
- Check test environment: ensure test services are running on correct ports