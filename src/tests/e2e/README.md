# E2E Test Suite - Restructured

This directory contains the restructured end-to-end test suite for the AutoPwn application. The tests are organized by feature with proper session management and database cleanup.

## 📁 Directory Structure

```
e2e/
├── setup/
│   ├── database-cleanup.ts          # Database cleanup utilities
│   ├── system-initialization.spec.ts # System initialization test
│   └── session-manager.ts           # Session storage and sharing
├── auth/
│   ├── login.spec.ts                # Authentication and login tests
│   ├── password-change.spec.ts      # Password change functionality tests
│   └── auth-guards.spec.ts         # Authentication guards and route protection
├── jobs/
│   ├── job-creation.spec.ts         # Job creation and configuration tests
│   ├── job-monitoring.spec.ts       # Job monitoring and progress tracking tests
│   ├── job-control.spec.ts          # Job control (pause/stop/restart) tests
│   └── job-results.spec.ts          # Job results viewing and export tests
├── upload/
│   ├── dictionary-upload.spec.ts    # Dictionary file upload tests
│   ├── pcap-upload.spec.ts          # PCAP file upload and network extraction tests
│   └── file-management.spec.ts      # File management and deletion tests
├── user-management/
│   ├── user-creation.spec.ts        # User creation and validation tests
│   ├── user-editing.spec.ts         # User editing and password management tests
│   └── user-permissions.spec.ts     # User roles and permission tests
├── workflows/
│   ├── basic-workflow.spec.ts       # Simple end-to-end workflow tests
│   └── advanced-workflow.spec.ts    # Complex workflow and multi-job scenario tests
├── helpers/
│   ├── test-helpers.ts              # Common test utilities and API helpers
│   ├── global-setup.ts              # Global test setup with database cleanup
│   └── global-teardown.ts           # Global test cleanup and session clearing
└── fixtures/                        # Test data files (see fixtures/README.md)
```

## 🧪 Test Categories

### 🔐 Authentication Tests (`auth/`)

**Files**: `login.spec.ts`, `password-change.spec.ts`, `auth-guards.spec.ts`

Tests the complete authentication flow including:

- Login functionality and validation
- Password change requirements and validation
- Authentication guards and route protection
- Session persistence and management

### 👥 User Management Tests (`user-management/`)

**Files**: `user-creation.spec.ts`, `user-editing.spec.ts`, `user-permissions.spec.ts`

Tests user administration features:

- Creating and managing users with different roles
- User editing and password management
- Role-based access control and permissions
- User search and filtering

### 📤 File Upload Tests (`upload/`)

**Files**: `dictionary-upload.spec.ts`, `pcap-upload.spec.ts`, `file-management.spec.ts`

Tests file upload functionality:

- Dictionary file uploads and validation
- PCAP file uploads and network extraction
- Upload progress tracking and error handling
- File management and deletion

### 🚀 Job Management Tests (`jobs/`)

**Files**: `job-creation.spec.ts`, `job-monitoring.spec.ts`, `job-control.spec.ts`, `job-results.spec.ts`

Tests password cracking job functionality:

- Job creation and configuration
- Job monitoring and progress tracking
- Job control (pause/stop/restart)
- Results viewing and export

### 🔄 Workflow Tests (`workflows/`)

**Files**: `basic-workflow.spec.ts`, `advanced-workflow.spec.ts`

Tests complete end-to-end workflows:

- Basic upload-to-crack workflows
- Multi-job scenarios and concurrent execution
- Complex workflows with user management
- Session persistence across workflows

## 🛠️ Test Infrastructure

### Session Management (`setup/session-manager.ts`)

The `SessionManager` class provides:

- Session storage and retrieval between test files
- Session validation and refresh mechanisms
- Automatic session cleanup after tests

### Database Cleanup (`setup/database-cleanup.ts`)

The `DatabaseCleanup` class provides:

- Complete database cleanup before and after test runs
- Proper handling of foreign key constraints
- Clean test state isolation

### System Initialization (`setup/system-initialization.spec.ts`)

A dedicated test that:

- Runs first to initialize the system
- Creates the superuser account
- Handles initial password change
- Stores session for subsequent tests

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
pnpm test:e2e auth/login.spec.ts

# Run tests matching a pattern
pnpm test:e2e --grep "Authentication"
pnpm test:e2e --grep "User Management"
pnpm test:e2e --grep "Upload"
pnpm test:e2e --grep "Jobs"
pnpm test:e2e --grep "Workflow"
```

### Environment Variables

```bash
# Set custom base URL
BASE_URL=http://localhost:3000

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
- Session data (`e2e-session.json`)

## 🔧 Configuration

The test suite is configured via `playwright.config.ts`:

- Test directory: `./src/tests/e2e`
- Browser: Chromium (Desktop Chrome)
- Base URL: `http://localhost:3000`
- Global setup/teardown: enabled
- Parallel execution: disabled (for session management)
- Retries: 2 in CI, 0 locally

## 📝 Best Practices

### Test Organization

- Tests are organized by feature with smaller, focused files
- Session state is shared between tests using the SessionManager
- Database cleanup ensures test isolation
- Tests run with authentication enabled (no DISABLE_AUTH)

### Session Management

- Tests use `TestHelpers.loginWithSession()` for authentication
- Session data is automatically saved and loaded
- Sessions are validated before use
- Session cleanup happens after test completion

### Error Handling

- Tests include both positive and negative scenarios
- Error messages are validated for user-friendliness
- Edge cases and boundary conditions are tested
- Proper assertions validate behavior

### Performance

- Session persistence reduces redundant authentication
- Database cleanup ensures clean test state
- Appropriate timeouts prevent test failures
- Resource cleanup prevents memory leaks

## 🚨 Troubleshooting

### Common Issues

1. **Tests fail with "No session cookie found"**
   - Ensure proper authentication in `beforeAll` hooks
   - Check that session files are being created in `test-results/`
   - Verify session validation logic

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
pnpm test:e2e --debug auth/login.spec.ts
```

## 📈 Coverage and Metrics

The test suite covers:

- ✅ Authentication flows with session management
- ✅ User management with role-based access
- ✅ File upload and validation
- ✅ Job creation, monitoring, and control
- ✅ Complete workflows with session persistence
- ✅ Error handling and edge cases
- ✅ UI interactions and API endpoints
- ✅ Database cleanup and test isolation

Test metrics are tracked in:

- Code coverage (when enabled)
- Test execution time
- Pass/fail rates
- Session persistence performance

## 🔄 Migration from Old Structure

The old monolithic test files have been broken down as follows:

- `auth/auth.spec.ts` → `auth/login.spec.ts`, `auth/password-change.spec.ts`, `auth/auth-guards.spec.ts`
- `jobs/jobs.spec.ts` → `jobs/job-creation.spec.ts`, `jobs/job-monitoring.spec.ts`, `jobs/job-control.spec.ts`, `jobs/job-results.spec.ts`
- `upload/upload.spec.ts` → `upload/dictionary-upload.spec.ts`, `upload/pcap-upload.spec.ts`, `upload/file-management.spec.ts`
- `user-management/user-management.spec.ts` → `user-management/user-creation.spec.ts`, `user-management/user-editing.spec.ts`, `user-management/user-permissions.spec.ts`
- `workflows/complete-workflow.spec.ts` → `workflows/basic-workflow.spec.ts`, `workflows/advanced-workflow.spec.ts`

---

## 🤝 Contributing

When adding new tests:

1. Choose the appropriate directory based on functionality
2. Use `TestHelpers.loginWithSession()` for authentication
3. Follow the existing patterns and naming conventions
4. Add proper assertions and error handling
5. Test both positive and negative scenarios
6. Ensure tests are isolated and don't depend on each other
7. Update this README if adding new test categories

For questions about the test suite, refer to the Playwright documentation or the existing test files for examples.
