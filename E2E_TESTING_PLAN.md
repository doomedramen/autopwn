# CrackHouse E2E Testing Plan

## Overview
This plan outlines the implementation of End-to-End (E2E) tests using Playwright for the CrackHouse web application.

## Current State
- **Framework**: Next.js 16.1.1 with React 19.1.1
- **Playwright Config**: Already defined at `apps/web/playwright.config.ts`
- **Tests Directory**: Does not exist yet (`apps/web/tests/`)
- **Playwright Dependency**: Not installed in package.json
- **Test Server**: Configured to start on `http://localhost:3000`

---

## Phase 1: Setup & Infrastructure (Week 1)

### 1.1 Install Dependencies
```bash
pnpm add -D -w @playwright/test
pnpm exec playwright install chromium
```

### 1.2 Create Directory Structure
```
apps/web/tests/
├── specs/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── signup.spec.ts
│   │   └── password-reset.spec.ts
│   ├── networks/
│   │   ├── viewing.spec.ts
│   │   └── management.spec.ts
│   ├── dictionaries/
│   │   ├── upload.spec.ts
│   │   └── management.spec.ts
│   ├── jobs/
│   │   ├── creation.spec.ts
│   │   └── monitoring.spec.ts
│   ├── results/
│   │   └── viewing.spec.ts
│   └── admin/
│       ├── users.spec.ts
│       └── dashboard.spec.ts
├── fixtures/
│   ├── test-users.ts
│   ├── test-data.ts
│   └── api-helpers.ts
├── helpers/
│   ├── auth-helpers.ts
│   ├── navigation.ts
│   └── wait-helpers.ts
├── global-setup.ts
├── global-teardown.ts
└── auth.setup.ts
```

### 1.3 Create Test Fixtures
- `auth.fixture.ts` - Pre-configured authenticated browser contexts
- `database.fixture.ts` - Test database cleanup utilities
- `api.fixture.ts` - API mocking helpers

---

## Phase 2: Authentication Tests (Priority 1)

### 2.1 Login Flow (`specs/auth/login.spec.ts`)
```typescript
describe('Authentication', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'validPassword123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'wrongPassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'not-an-email')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid email')).toBeVisible()
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/sign-in')
  })
})
```

### 2.2 Signup Flow (`specs/auth/signup.spec.ts`)
- Valid registration
- Password validation
- Email validation
- Duplicate email handling

### 2.3 Password Reset (`specs/auth/password-reset.spec.ts`)
- Request reset flow
- Invalid email handling
- Reset with valid token

### 2.4 Logout
- Successful logout
- Redirect to login after logout

---

## Phase 3: Core Feature Tests (Priority 2)

### 3.1 Dashboard Tests
```typescript
describe('Dashboard', () => {
  test.use({ storageState: 'playwright/.auth/user.json' })

  test('should display all tabs', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="networks-tab"]')).toBeVisible()
    await expect(page.locator('[data-testid="dictionaries-tab"]')).toBeVisible()
    await expect(page.locator('[data-testid="jobs-tab"]')).toBeVisible()
    await expect(page.locator('[data-testid="results-tab"]')).toBeVisible()
  })

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="dictionaries-tab"]')
    await expect(page.locator('text=Dictionaries')).toBeVisible()
  })

  test('should show tab counts', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="networks-count"]')).toBeVisible()
  })
})
```

### 3.2 Networks Tab
- View network list
- Search/filter networks
- Select network
- View network details
- Status indicators

### 3.3 Dictionaries Tab
- View dictionary list
- Upload dictionary
- Generate dictionary
- View dictionary stats
- Merge dictionaries
- Delete dictionary

### 3.4 Jobs Tab
- Create new job (with modal)
- Monitor job progress
- Cancel job
- Retry failed job
- Filter by status
- Job status indicators

### 3.5 Results Tab
- View results list
- Filter results
- Export results
- View cracked passwords
- Search functionality

---

## Phase 4: Admin Tests (Priority 3)

### 4.1 User Management (`specs/admin/users.spec.ts`)
```typescript
describe('User Management', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' })

  test('should display users list', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="users-tab"]')
    await expect(page.locator('table tbody tr')).toHaveCount.gte(1)
  })

  test('should create new user', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="users-tab"]')
    await page.click('button:has-text("Add User")')
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="name"]', 'Test User')
    await page.selectOption('select[name="role"]', 'user')
    await page.click('button:has-text("Create")')
    await expect(page.locator('text=User created successfully')).toBeVisible()
  })

  test('should update user role', async ({ page }) => {
    // Implementation
  })

  test('should delete user', async ({ page }) => {
    // Implementation
  })
})
```

### 4.2 Admin Dashboard
- System health status
- Audit logs
- System configuration

---

## Phase 5: Integration Tests (Priority 4)

### 5.1 Full Workflow Tests
```typescript
describe('Full Penetration Test Workflow', () => {
  test.use({ storageState: 'playwright/.auth/user.json' })

  test('should complete full workflow: upload → capture → job → results', async ({ page }) => {
    // 1. Upload PCAP file
    await page.goto('/')
    await page.click('button:has-text("Upload PCAP")')
    // ... upload test file

    // 2. View networks from capture
    await page.click('[data-testid="networks-tab"]')
    // ... verify networks appear

    // 3. Create job for network
    await page.click('button:has-text("New Job")')
    // ... select network and dictionary

    // 4. Monitor job progress
    await page.click('[data-testid="jobs-tab"]')
    // ... verify job completes

    // 5. View results
    await page.click('[data-testid="results-tab"]')
    // ... verify results appear
  })
})
```

---

## Implementation Checklist

### Setup Tasks
- [ ] Install `@playwright/test` in workspace
- [ ] Create tests directory structure
- [ ] Create `tests/fixtures/test-users.ts`
- [ ] Create `tests/fixtures/test-data.ts`
- [ ] Create `tests/helpers/auth-helpers.ts`
- [ ] Create `tests/global-setup.ts` - database seeding
- [ ] Create `tests/global-teardown.ts` - database cleanup
- [ ] Create `tests/auth.setup.ts` - login state setup
- [ ] Add test scripts to package.json

### Auth Tests
- [ ] Login form displays correctly
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Email validation
- [ ] Password validation
- [ ] Signup new user
- [ ] Duplicate email handling
- [ ] Password reset request
- [ ] Logout functionality
- [ ] Protected route redirect

### Dashboard Tests
- [ ] All tabs visible
- [ ] Tab switching works
- [ ] Tab counts display
- [ ] Stats cards display
- [ ] Create job modal opens
- [ ] Upload modal opens

### Network Tests
- [ ] Network list displays
- [ ] Search networks
- [ ] Filter by status
- [ ] Select network
- [ ] Network details panel

### Dictionary Tests
- [ ] Dictionary list displays
- [ ] Upload dictionary
- [ ] File validation
- [ ] Generate dictionary
- [ ] View dictionary stats
- [ ] Delete dictionary
- [ ] Merge dictionaries

### Job Tests
- [ ] Job list displays
- [ ] Create job modal
- [ ] Select network
- [ ] Select dictionary
- [ ] Submit job
- [ ] Monitor job progress
- [ ] Cancel job
- [ ] Retry failed job
- [ ] Filter by status
- [ ] Bulk operations

### Results Tests
- [ ] Results list displays
- [ ] Filter results
- [ ] Export results
- [ ] View cracked passwords
- [ ] Search results

### Admin Tests
- [ ] Users list displays
- [ ] Create user
- [ ] Update user
- [ ] Delete user
- [ ] Change user role
- [ ] Admin dashboard displays
- [ ] System health status
- [ ] Audit logs display
- [ ] Configuration changes

---

## Test Data Strategy

### Database Seeding
```typescript
// tests/fixtures/test-data.ts
export const testUsers = {
  admin: { email: 'admin@test.com', password: 'Admin123!', role: 'admin' },
  user: { email: 'user@test.com', password: 'User123!', role: 'user' },
}

export const seedDatabase = async () => {
  // Create test users via API
  // Create sample networks
  // Create sample dictionaries
  // Create sample jobs
}

export const cleanupDatabase = async () => {
  // Remove test data
}
```

### PCAP Test Files
Place test PCAP files in `apps/web/tests/fixtures/files/`:
- `test-small.pcap` - Small file for quick tests
- `test-large.pcap` - File for testing upload limits
- `test-invalid.pcap` - Invalid PCAP for error handling

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: pnpm install
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      - name: Start services
        run: docker-compose up -d
      - name: Run E2E tests
        run: pnpm test:e2e
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

---

## Success Metrics

- **Coverage**: All user-facing features have basic E2E coverage
- **Reliability**: < 5% flaky test rate
- **Speed**: Full suite runs in < 10 minutes
- **Maintenance**: Tests are easy to update when UI changes

---

## Next Steps

1. **Install dependencies and create directory structure**
2. **Implement authentication tests first** (blocks other tests)
3. **Create test fixtures and helpers** for reusability
4. **Implement core feature tests** (networks, dictionaries, jobs, results)
5. **Implement admin tests**
6. **Set up CI/CD integration**
7. **Document test writing guidelines**
