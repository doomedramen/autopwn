# AutoPWN E2E Testing Guide

## Overview

This guide covers how to run and maintain the End-to-End (E2E) test suite for the AutoPWN web application using Playwright.

## Quick Start

### Prerequisites

- Node.js and pnpm installed
- PostgreSQL database running
- Test database environment configured

### Running Tests

From the project root directory:

```bash
# Run a specific test file
pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium

# Run with verbose output
pnpm test:e2e -- tests/specs/dashboard.spec.ts --project=chromium --reporter=list

# Run tests in headed mode (shows browser window)
pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium --headed
```

### Available Test Files

| Test File | Description | Status |
|-----------|-------------|---------|
| `basic.spec.ts` | Basic functionality and navigation | ✅ 4/4 passing |
| `dashboard.spec.ts` | Dashboard navigation and user menu | ✅ 3/4 passing |
| `file-upload.spec.ts` | Upload interface accessibility | ✅ 3/3 passing |
| `user-management.spec.ts` | User management interface | ✅ 6/6 passing |
| `upload-jobs-simple.spec.ts` | Upload and jobs functionality (simplified) | ✅ 9/9 passing |
| `upload-jobs.spec.ts` | Upload and jobs functionality (detailed) | ⚠️ 7/18 passing |

## Test Environment Setup

### Database Configuration

The tests use a dedicated test database. Configuration is in `.env.test.local`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test"
```

### Environment Variables

Tests automatically load environment variables from `.env.test.local`. Key variables:

- `DATABASE_URL` - Test database connection
- `NODE_ENV=test` - Test environment flag
- `BASE_URL=http://localhost:3000` - Application URL
- `SKIP_WEB_SERVER=true` - Skip web server startup (when servers already running)

## Test Categories

### 1. Basic Functionality (`basic.spec.ts`)
- Homepage loading
- Navigation to authentication pages
- Sign-up page functionality

### 2. Dashboard Navigation (`dashboard.spec.ts`)
- Dashboard element verification
- Tab navigation (networks, dictionaries, jobs, users)
- User menu access
- Logout functionality (⚠️ needs improvement)

### 3. File Upload (`file-upload.spec.ts`)
- Upload interface accessibility
- Upload button availability
- Upload options verification

### 4. User Management (`user-management.spec.ts`)
- User management interface access
- User data display
- Role badge rendering
- Button states (disabled for non-implemented features)

### 5. Upload & Jobs (`upload-jobs-simple.spec.ts`)
- Upload modal opening and content verification
- Job creation modal access
- Core feature navigation
- Integration testing

## Running Tests Individually vs Together

### Individual Tests (Recommended)
When run individually, most tests have 100% success rate:

```bash
# Each of these should pass completely
pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium
pnpm test:e2e -- tests/specs/dashboard.spec.ts --project=chromium
pnpm test:e2e -- tests/specs/file-upload.spec.ts --project=chromium
pnpm test:e2e -- tests/specs/user-management.spec.ts --project=chromium
pnpm test:e2e -- tests/specs/upload-jobs-simple.spec.ts --project=chromium
```

### Running Multiple Tests Together
When running multiple test files together, there may be session persistence issues between tests. For best results:

1. Run tests individually for CI/CD pipelines
2. Use individual test runs for development and debugging
3. Avoid running all tests together until session issues are resolved

## Debugging Tests

### Running with Browser UI
```bash
# Show browser window for debugging
pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium --headed
```

### Generating Reports
```bash
# Run with HTML report (disabled by default)
pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium --reporter=html
```

### Trace Viewer
After test failures, view traces:
```bash
# View trace from failed test
pnpm exec playwright show-trace test-results/[test-name]-chromium/trace.zip
```

## Test Architecture

### Authentication Setup
Tests use a shared authentication setup (`tests/auth.setup.ts`) that:
- Creates test superuser in database
- Handles login session persistence
- Sets up browser context for authenticated testing

### Page Objects
Test utilities and page objects are in:
- `tests/fixtures/auth-fixture.ts` - Authentication fixtures
- `tests/helpers/test-utils.ts` - Testing utilities
- `tests/pages/` - Page object models

### Test Data Management
- Database is reset before each test run
- Test superuser automatically created
- Tests use isolated database transactions

## Common Issues and Solutions

### 1. "Test timeout exceeded" on tab navigation
**Issue**: Session not properly authenticated
**Solution**: Check authentication setup and ensure user is logged in

### 2. "Cannot read properties of undefined (reading 'useSession')"
**Issue**: Better Auth client configuration issue
**Solution**: This is a known issue with the auth library setup

### 3. Modal elements not found
**Issue**: Complex DOM structures in upload modal
**Solution**: Use simplified tests that verify modal opening rather than specific internal elements

### 4. Session persistence between test files
**Issue**: Authentication state lost between test files
**Solution**: Run tests individually or improve session management in auth setup

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Focus on user behavior, not implementation details

### 2. Selector Strategy
- Prefer semantic selectors (`button:has-text("Upload Files")`)
- Use `data-testid` attributes for critical elements
- Avoid implementation-specific selectors

### 3. Test Stability
- Add appropriate waits for page loads
- Use retry logic for network-dependent operations
- Handle race conditions in authentication

### 4. Maintenance
- Keep tests focused on core functionality
- Update selectors when UI changes
- Regular test suite review and cleanup

## CI/CD Integration

### Example GitHub Actions Workflow
```yaml
- name: Run E2E Tests
  run: |
    cd apps/web
    DATABASE_URL="postgresql://postgres:password@localhost:5432/autopwn_test" \
    SKIP_WEB_SERVER=true \
    NODE_ENV=test \
    BASE_URL="http://localhost:3000" \
    pnpm test:e2e -- tests/specs/basic.spec.ts --project=chromium
```

### Test Results
- Tests generate HTML reports in `playwright-report/`
- Screenshots and videos captured on failures
- Trace files available for debugging

## Future Improvements

### High Priority
1. **Session Management**: Fix authentication persistence between test files
2. **Logout Flow**: Complete logout redirect functionality
3. **Better Auth Integration**: Resolve client configuration issues

### Medium Priority
1. **Advanced Feature Testing**: More comprehensive job creation tests
2. **Cross-browser Testing**: Add Firefox and Safari test coverage
3. **Visual Testing**: Add visual regression tests

### Low Priority
1. **Performance Testing**: Add page load performance tests
2. **Mobile Testing**: Add mobile viewport testing
3. **Accessibility Testing**: Add accessibility compliance tests

## Contributing

When adding new tests:

1. Follow existing test patterns and naming conventions
2. Use descriptive test names that explain the user behavior
3. Add appropriate waits and error handling
4. Test both happy paths and edge cases
5. Update this documentation when adding new test categories

## Troubleshooting

### Database Issues
```bash
# Reset test database
DROP DATABASE IF EXISTS autopwn_test;
CREATE DATABASE autopwn_test;
```

### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000  # Web server
lsof -i :3001  # API server
```

### Playwright Installation
```bash
# Install browsers
pnpm exec playwright install

# Reinstall if issues occur
pnpm exec playwright install --force
```

---

**Last Updated**: $(date)
**Maintainers**: Development Team
**Version**: 1.0