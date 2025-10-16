# E2E Tests

End-to-end tests organized by feature with session management and cleanup.

## Structure

- `auth/` - Authentication and authorization
- `jobs/` - Job creation, monitoring, control
- `upload/` - File upload and management
- `user-management/` - User administration
- `workflows/` - Complete end-to-end flows
- `helpers/` - Test utilities and setup
- `fixtures/` - Test data files

## Running Tests

```bash
# All tests
pnpm test:e2e

# Debug mode
pnpm test:e2e:ui

# Specific test
pnpm test:e2e auth/login.spec.ts

# With pattern
pnpm test:e2e --grep "Authentication"
```

## Environment

```bash
BASE_URL=http://localhost:3000
PLAYWRIGHT_COVERAGE=true
DEBUG=pw:api
```

## Features Covered

- ✅ Authentication flows
- ✅ User management
- ✅ File uploads
- ✅ Job management
- ✅ Complete workflows
- ✅ Error handling

## Session Management

Tests use `TestHelpers.loginWithSession()` for authentication with automatic session persistence and cleanup.
