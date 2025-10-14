# E2E Test Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the current e2e test structure to the new, improved architecture with session management and database cleanup.

## Migration Steps

### Phase 1: Setup Infrastructure

1. **Create the new directory structure**

```bash
mkdir -p src/tests/e2e/setup
mkdir -p src/tests/e2e/auth
mkdir -p src/tests/e2e/jobs
mkdir -p src/tests/e2e/upload
mkdir -p src/tests/e2e/user-management
mkdir -p src/tests/e2e/workflows
```

2. **Implement database cleanup utilities**

Create `src/tests/e2e/setup/database-cleanup.ts` using the code from the implementation guide.

3. **Implement session manager**

Create `src/tests/e2e/setup/session-manager.ts` using the code from the implementation guide.

4. **Update global setup and teardown**

Replace the content of `src/tests/e2e/helpers/global-setup.ts` and `src/tests/e2e/helpers/global-teardown.ts` with the updated versions from the implementation guide.

### Phase 2: System Initialization

1. **Create system initialization test**

Create `src/tests/e2e/setup/system-initialization.spec.ts` using the code from the implementation guide.

2. **Update test helpers**

Modify `src/tests/e2e/helpers/test-helpers.ts` to include the new session management methods.

### Phase 3: Refactor Test Files

#### Authentication Tests

1. **Split `src/tests/e2e/auth/auth.spec.ts` into:**

- `src/tests/e2e/auth/login.spec.ts`
  - Login functionality tests
  - Login validation tests
  - Invalid credentials tests

- `src/tests/e2e/auth/password-change.spec.ts`
  - Password change requirement tests
  - Password validation tests
  - Password change success tests

- `src/tests/e2e/auth/auth-guards.spec.ts`
  - Route protection tests
  - Public route access tests
  - Authentication guard tests

#### Job Management Tests

1. **Split `src/tests/e2e/jobs/jobs.spec.ts` into:**

- `src/tests/e2e/jobs/job-creation.spec.ts`
  - Job creation via UI
  - Job creation via API
  - Job creation validation

- `src/tests/e2e/jobs/job-monitoring.spec.ts`
  - Job status display
  - Job progress tracking
  - Job details view

- `src/tests/e2e/jobs/job-control.spec.ts`
  - Job pause/resume
  - Job stopping
  - Job restarting

- `src/tests/e2e/jobs/job-results.spec.ts`
  - Cracked passwords display
  - Results export
  - Job statistics

#### Upload Tests

1. **Split `src/tests/e2e/upload/upload.spec.ts` into:**

- `src/tests/e2e/upload/dictionary-upload.spec.ts`
  - Dictionary upload via API
  - Dictionary upload via UI
  - Dictionary validation

- `src/tests/e2e/upload/pcap-upload.spec.ts`
  - PCAP upload via API
  - PCAP upload via UI
  - Network extraction

- `src/tests/e2e/upload/file-management.spec.ts`
  - File listing
  - File deletion
  - File details

#### User Management Tests

1. **Split `src/tests/e2e/user-management/user-management.spec.ts` into:**

- `src/tests/e2e/user-management/user-creation.spec.ts`
  - User creation via UI
  - User creation validation
  - Role assignment

- `src/tests/e2e/user-management/user-editing.spec.ts`
  - User information editing
  - Password management
  - Status toggling

- `src/tests/e2e/user-management/user-permissions.spec.ts`
  - Role-based access control
  - Permission validation
  - Admin vs user access

#### Workflow Tests

1. **Refactor `src/tests/e2e/workflows/complete-workflow.spec.ts` into:**

- `src/tests/e2e/workflows/basic-workflow.spec.ts`
  - Simple upload-to-crack workflow
  - Basic job creation and monitoring

- `src/tests/e2e/workflows/advanced-workflow.spec.ts`
  - Multiple job scenarios
  - Complex workflow testing

### Phase 4: Update Configuration

1. **Update Playwright configuration**

Modify `playwright.config.ts` to ensure proper test ordering and setup:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: false, // Disable full parallelism for session management
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Keep single worker for database consistency
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  globalSetup: require.resolve("./src/tests/e2e/helpers/global-setup.ts"),
  globalTeardown: require.resolve("./src/tests/e2e/helpers/global-teardown.ts"),

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120000,
  },
});
```

### Phase 5: Update Documentation

1. **Update README.md**

Replace the content of `src/tests/e2e/README.md` with the new structure documentation.

2. **Create migration documentation**

Document the changes for team members and future reference.

## Migration Script

Create a script to help with the migration:

```bash
#!/bin/bash
# migrate-e2e-tests.sh

echo "🚀 Starting E2E test migration..."

# Create new directories
echo "📁 Creating new directory structure..."
mkdir -p src/tests/e2e/setup
mkdir -p src/tests/e2e/auth
mkdir -p src/tests/e2e/jobs
mkdir -p src/tests/e2e/upload
mkdir -p src/tests/e2e/user-management
mkdir -p src/tests/e2e/workflows

# Backup existing tests
echo "💾 Backing up existing tests..."
mkdir -p src/tests/e2e/backup
cp -r src/tests/e2e/auth src/tests/e2e/backup/
cp -r src/tests/e2e/jobs src/tests/e2e/backup/
cp -r src/tests/e2e/upload src/tests/e2e/backup/
cp -r src/tests/e2e/user-management src/tests/e2e/backup/
cp -r src/tests/e2e/workflows src/tests/e2e/backup/
cp src/tests/e2e/helpers/*.ts src/tests/e2e/backup/

echo "✅ Directory structure created"
echo "📝 Please manually implement the new test files according to the migration guide"
echo "🧪 Run tests to verify the migration: pnpm test:e2e"
```

## Validation Checklist

After completing the migration, verify the following:

- [ ] All new test files are created
- [ ] Database cleanup works before and after tests
- [ ] Session management works across test files
- [ ] System initialization test runs first
- [ ] All tests pass without DISABLE_AUTH
- [ ] Test execution time is improved
- [ ] No test dependencies are broken
- [ ] Documentation is updated

## Rollback Plan

If issues arise during migration:

1. **Restore from backup**

```bash
# Restore backed up files
cp -r src/tests/e2e/backup/* src/tests/e2e/
```

2. **Restore original configuration**

Revert changes to `playwright.config.ts` and global setup/teardown files.

3. **Verify functionality**

Run tests to ensure everything works as before.

## Troubleshooting

### Common Issues

1. **Session not persisting between tests**
   - Check that session file is being created
   - Verify session validation logic
   - Ensure tests are not running in parallel

2. **Database cleanup failing**
   - Check database connection
   - Verify table order in cleanup script
   - Ensure proper foreign key constraint handling

3. **Tests failing with authentication errors**
   - Remove DISABLE_AUTH environment variable
   - Check session loading logic
   - Verify authentication flow

4. **Test ordering issues**
   - Ensure system initialization test runs first
   - Check test dependencies
   - Verify Playwright configuration

## Benefits After Migration

1. **Improved test execution time**
   - No repeated authentication
   - Shared session state
   - Efficient database cleanup

2. **Better maintainability**
   - Smaller, focused test files
   - Clear separation of concerns
   - Easier debugging

3. **More realistic testing**
   - Tests run with authentication enabled
   - Proper session management
   - Clean database state

4. **Enhanced developer experience**
   - Faster test feedback
   - Easier to add new tests
   - Better error reporting