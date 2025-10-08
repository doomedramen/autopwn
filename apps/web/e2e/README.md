# E2E Tests

Simple end-to-end testing for AutoPWN using Playwright.

## Quick Start

```bash
# One-time setup
make test-setup

# Run tests
make test

# Debug tests (shows browser)
make test-debug

# Clean test results
make clean
```

## Test Results

Tests show clear console output like this:
```
✓  1 [chromium] › e2e/auth.spec.ts:50:7 › Authentication › should allow successful sign in (2.1s)
✓  2 [chromium] › e2e/dashboard.spec.ts:16:7 › Dashboard › should display dashboard components (1.3s)
✘  3 [chromium] › e2e/job-management.spec.ts:17:7 › Job Management › should create a new job (5.2s)
```

- ✓ = Pass
- ✘ = Fail
- Shows test file, line number, and execution time

## Test Files

- `auth.spec.ts` - Login/signup/logout
- `dashboard.spec.ts` - Main dashboard functionality
- `job-management.spec.ts` - Job creation and management
- `websocket.spec.ts` - Real-time updates
- `responsive.spec.ts` - Mobile/tablet/desktop views

## When Tests Fail

Failed tests automatically create:
- Screenshots: `test-results/*/test-failed-1.png`
- Videos: `test-results/*/video.webm`
- Traces: `test-results/*/trace.zip`

## Manual Commands

```bash
# Direct npm commands
npm run test              # Run tests
npm run test:debug        # Debug mode
npm run test:ci           # CI mode (no dev server)

# Specific test file
npm run test -- auth.spec.ts

# Specific browser
npm run test -- --project=chromium
```

That's it! Simple, clear, and focused on running tests and seeing results.