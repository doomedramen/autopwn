# E2E Test Suite

This directory contains the end-to-end test suite for the AutoPwn application. The tests are organized by feature and use Playwright for browser automation and API testing.

## 📁 Directory Structure

```
e2e/
├── auth/
│   └── auth.spec.ts                 # Authentication and authorization tests
├── helpers/
│   ├── test-helpers.ts              # Common test utilities and API helpers
│   ├── global-setup.ts              # Global test setup configuration
│   ├── global-teardown.ts           # Global test cleanup
│   └── global-setup.ts              # Legacy setup file (to be removed)
├── jobs/
│   └── jobs.spec.ts                 # Job management and execution tests
├── upload/
│   └── upload.spec.ts               # File upload functionality tests
├── user-management/
│   └── user-management.spec.ts      # User management interface tests
├── workflows/
│   └── complete-workflow.spec.ts    # End-to-end workflow tests
├── fixtures/                        # Test data files (see fixtures/README.md)
├── global-setup.ts                  # Legacy global setup (to be removed)
├── global-teardown.ts               # Legacy global teardown (to be removed)
├── test-utils.ts                    # Legacy test utilities (to be removed)
├── auth-disabled.spec.ts            # Legacy auth tests (to be removed)
├── auth-flow.spec.ts                # Legacy auth tests (to be removed)
├── complete-workflow.spec.ts        # Legacy workflow tests (to be removed)
├── comprehensive-workflow.spec.ts   # Legacy workflow tests (to be removed)
└── user-management.spec.ts          # Legacy user tests (to be removed)
```

## 🧪 Test Categories

### 🔐 Authentication Tests (`auth/`)

**File**: `auth/auth.spec.ts`

Tests the complete authentication flow including:

- System initialization and superuser creation
- Login/logout functionality
- Password change requirements
- Authentication guards and route protection
- Auth-disabled mode behavior

### 👥 User Management Tests (`user-management/`)

**File**: `user-management/user-management.spec.ts`

Tests user administration features:

- Creating and managing users
- Role-based access control
- User status management (active/inactive)
- User search and filtering
- User editing and validation

### 📤 File Upload Tests (`upload/`)

**File**: `upload/upload.spec.ts`

Tests file upload functionality:

- Dictionary file uploads and validation
- PCAP file uploads and network extraction
- Upload progress tracking
- File management and deletion
- Error handling for invalid files

### 🚀 Job Management Tests (`jobs/`)

**File**: `jobs/jobs.spec.ts`

Tests password cracking job functionality:

- Job creation and configuration
- Job monitoring and progress tracking
- Job control (pause/stop/restart)
- Results viewing and export
- Job filtering and search

### 🔄 Workflow Tests (`workflows/`)

**File**: `workflows/complete-workflow.spec.ts`

Tests complete end-to-end workflows:

- Full upload-to-crack workflows
- Multi-job scenarios
- Integration between components
- Error handling in complex scenarios

## 🛠️ Test Utilities

### Main Helper (`helpers/test-helpers.ts`)

The `TestHelpers` class provides common utilities for:

- System initialization and authentication
- API requests with proper headers
- File uploads (dictionaries and PCAPs)
- Job creation and monitoring
- Navigation and UI interactions
- Test data generation

### Global Setup (`helpers/global-setup.ts`)

Handles global test environment setup:

- Environment variable configuration
- Test directory creation
- Fixture validation
- Cleanup of previous test artifacts

### Global Teardown (`helpers/global-teardown.ts`)

Handles post-test cleanup:

- Test report generation
- Temporary file cleanup
- Coverage report generation
- Environment cleanup

## 🏃 Running Tests

### Basic Commands

```bash
# Run all e2e tests
pnpm test:e2e

# Run tests with UI (for debugging)
pnpm test:e2e:ui

# Run tests in headed mode (visible browser)
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e auth/auth.spec.ts

# Run tests matching a pattern
pnpm test:e2e --grep "Authentication"
pnpm test:e2e --grep "User Management"
```

### Environment Variables

```bash
# Disable authentication for faster testing
DISABLE_AUTH=true

# Set custom base URL
BASE_URL=http://localhost:3001

# Enable coverage reporting
PLAYWRIGHT_COVERAGE=true

# Run in debug mode
DEBUG=pw:api
```

## 📊 Test Reports

Test results are saved to the `test-results/` directory:

- Screenshots on failure
- Trace files for debugging
- HTML reports
- Video recordings (when enabled)
- Test summary documentation

## 🔧 Configuration

The test suite is configured via `playwright.config.ts`:

- Test directory: `./src/tests/e2e`
- Browser: Chromium (Desktop Chrome)
- Base URL: `http://localhost:3000`
- Global setup/teardown: enabled
- Parallel execution: disabled (for database consistency)
- Retries: 2 in CI, 0 locally

## 📝 Best Practices

### Test Organization

- Organize tests by feature, not by implementation
- Use descriptive test names that explain what is being tested
- Group related tests using `test.describe()`
- Keep test files focused on a single feature area

### Test Data

- Use the provided test fixtures instead of creating data in tests
- Generate unique test data using `TestHelpers.generateTestData()`
- Clean up test data after tests complete
- Don't hardcode credentials or sensitive data

### Error Handling

- Test both happy path and error scenarios
- Verify error messages are user-friendly
- Test edge cases and boundary conditions
- Use proper assertions to validate behavior

### Performance

- Use appropriate timeouts (not too short, not too long)
- Avoid unnecessary waits and delays
- Reuse authentication sessions across tests when possible
- Clean up resources to prevent memory leaks

## 🚨 Troubleshooting

### Common Issues

1. **Tests fail with "No session cookie found"**
   - Ensure proper authentication in `beforeAll` hooks
   - Check that auth headers are correctly set for API requests

2. **Tests timeout waiting for elements**
   - Increase timeout values for slow operations
   - Check that selectors are correct and elements exist
   - Verify the application is running and accessible

3. **Database cleanup issues**
   - Ensure proper test isolation
   - Check that global setup/teardown is working
   - Verify database connections are properly closed

4. **File upload failures**
   - Verify test fixtures exist and are accessible
   - Check file permissions and paths
   - Ensure upload directories are created and writable

### Debug Mode

Run tests with additional debugging:

```bash
# Enable Playwright debugging
DEBUG=pw:api pnpm test:e2e

# Run with visible browser
HEADED=true pnpm test:e2e

# Run specific test in debug mode
pnpm test:e2e --debug auth/auth.spec.ts
```

## 📈 Coverage and Metrics

The test suite covers:

- ✅ Authentication flows
- ✅ User management
- ✅ File upload and validation
- ✅ Job creation and monitoring
- ✅ Complete workflows
- ✅ Error handling
- ✅ UI interactions
- ✅ API endpoints

Test metrics are tracked in:

- Code coverage (when enabled)
- Test execution time
- Pass/fail rates
- Performance benchmarks

---

## 🤝 Contributing

When adding new tests:

1. Choose the appropriate directory based on functionality
2. Follow the existing patterns and naming conventions
3. Use `TestHelpers` for common operations
4. Add proper assertions and error handling
5. Update this README if adding new test categories
6. Test both positive and negative scenarios
7. Ensure tests are isolated and don't depend on each other

For questions about the test suite, refer to the Playwright documentation or the existing test files for examples.
