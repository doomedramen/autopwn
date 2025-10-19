# Testing Strategy

This document outlines the testing approach for autopwn.

## Philosophy: Pragmatic, Not Exhaustive

Autopwn uses a **pragmatic testing strategy** focused on:

✅ **Critical business logic** (RBAC, permissions, data transformations)
✅ **Integration points** (auth flows, API endpoints, database operations)
✅ **Happy paths + major error cases**
❌ **NOT aiming for 80%+ coverage** - that's overkill for this project

### Why Not Aim for High Coverage?

- **Integration-heavy**: External tools (hashcat, hcxpcapngtool) are hard to mock
- **Hardware-dependent**: GPU usage, file I/O, long-running processes
- **Self-hosted**: Not a SaaS with thousands of users - bugs are fixable
- **Small team**: Time better spent on features than exhaustive tests
- **Trust dependencies**: Fastify, Drizzle, Better Auth are well-tested

## Coverage Targets

```
Overall Project:     40-50%  ✅ Pragmatic
Business Logic:      70-80%  ✅ Critical pure functions
API Routes:          50-60%  ✅ Happy paths + auth
Integration:         Critical paths only
E2E:                 Optional (2-3 flows)
```

## Testing Levels

### 1. Unit Tests (HIGH Priority)

**What to test:**
- ✅ RBAC functions (`lib/rbac.ts`)
- ✅ Config validation schemas
- ✅ Dictionary generation logic
- ✅ Utility functions (parsing, transformations)

**Run:**
```bash
pnpm --filter @autopwn/backend test
pnpm --filter @autopwn/backend test:watch
```

**Example:**
```typescript
// lib/rbac.test.ts
describe('RBAC', () => {
  it('should respect role hierarchy', () => {
    const admin = createMockUser('admin');
    expect(hasRole(admin, 'user')).toBe(true);
    expect(hasRole(admin, 'superuser')).toBe(false);
  });
});
```

### 2. Integration Tests (MEDIUM Priority)

**What to test:**
- ✅ Authentication flow (login → session → protected routes)
- ✅ PCAP upload → processing → network extraction
- ✅ Job creation → queue → results
- ✅ Database CRUD operations

**Requirements:**
- Real PostgreSQL database (test container or separate DB)
- Real Redis instance (test instance)

**Run:**
```bash
# Start test dependencies
docker compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm --filter @autopwn/backend test:integration

# Cleanup
docker compose -f docker-compose.test.yml down
```

**Example:**
```typescript
// routes/auth.integration.test.ts
describe('Auth Integration', () => {
  it('should login and access protected route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@test.com', password: 'password123' }
    });

    const cookie = res.cookies[0];
    const protectedRes = await app.inject({
      method: 'GET',
      url: '/api/captures',
      cookies: { session: cookie.value }
    });

    expect(protectedRes.statusCode).toBe(200);
  });
});
```

### 3. E2E Tests (LOW Priority - Optional)

**What to test (if time permits):**
- ⚠️ Complete workflow: Upload PCAP → Create job → Wait for results
- ⚠️ Admin actions: Create user → Assign role → Verify access

**Run:**
```bash
pnpm --filter @autopwn/backend test:e2e
```

### 4. What NOT to Test

❌ **External tool behavior** - hashcat, hcxpcapngtool (too brittle, not our code)
❌ **Database query correctness** - Trust Drizzle ORM
❌ **Better Auth internals** - Trust the library
❌ **Framework behavior** - Fastify, Next.js are well-tested
❌ **UI extensively** - Focus backend testing, basic frontend smoke tests

## Test Structure

```
apps/backend/
├── src/
│   ├── lib/
│   │   ├── rbac.ts
│   │   └── rbac.test.ts          # Unit tests next to code
│   ├── routes/
│   │   ├── auth.ts
│   │   └── auth.integration.test.ts  # Integration tests
│   └── test/
│       ├── setup.ts               # Global test setup
│       ├── helpers/               # Test utilities
│       │   ├── auth.ts            # Auth test helpers
│       │   ├── db.ts              # Database test helpers
│       │   └── factory.ts         # Test data factories
│       └── fixtures/              # Test data
│           └── sample.pcap
```

## Running Tests

```bash
# Unit tests only
pnpm --filter @autopwn/backend test

# Watch mode (development)
pnpm --filter @autopwn/backend test:watch

# Coverage report
pnpm --filter @autopwn/backend test:coverage

# Integration tests (requires test DB/Redis)
pnpm --filter @autopwn/backend test:integration

# All tests
pnpm --filter @autopwn/backend test:all
```

## Test Database

**Option 1: Separate test database**
```bash
# .env.test
DATABASE_URL=postgresql://autopwn:dev_password@localhost:5432/autopwn_test
REDIS_URL=redis://localhost:6379/1
```

**Option 2: Docker container (recommended)**
```yaml
# docker-compose.test.yml
services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: autopwn_test
      POSTGRES_USER: autopwn
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"

  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

## Mocking Strategy

**Prefer real implementations when possible:**
- ✅ Use real database (test container)
- ✅ Use real Redis (test instance)
- ✅ Use Better Auth (configured for test)

**Mock when necessary:**
- ✅ External HTTP calls (if we add them)
- ✅ File system operations (use temp directories)
- ✅ Long-running processes (hashcat - mock or use small test data)

**Example mock:**
```typescript
// For hashcat, use real small test files or mock the execution
const mockHashcat = vi.fn().mockResolvedValue({
  status: 'completed',
  crackedCount: 1,
});
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: autopwn_test
          POSTGRES_USER: autopwn
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter @autopwn/backend test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Best Practices

### ✅ DO

1. **Test business logic thoroughly** - RBAC, permissions, transformations
2. **Test critical paths** - Auth, PCAP processing, job execution
3. **Use real database/Redis for integration tests**
4. **Keep tests fast** - Mock slow external calls
5. **Use descriptive test names** - `should allow admin to access user resources`
6. **Test error cases** - Not just happy paths
7. **Use test helpers** - Factories for creating test data

### ❌ DON'T

1. **Don't aim for 100% coverage** - Diminishing returns
2. **Don't test framework internals** - Trust Fastify/Next.js
3. **Don't test external tools** - hashcat behavior is not our responsibility
4. **Don't over-mock** - Use real implementations when reasonable
5. **Don't skip tests on CI** - They should always run
6. **Don't commit commented-out tests** - Fix or delete them

## Test Helpers

### Auth Helper
```typescript
// test/helpers/auth.ts
export async function loginAsUser(app: FastifyInstance, role: UserRole) {
  const user = await createTestUser(role);
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: user.email, password: 'password123' }
  });
  return res.cookies[0].value;
}
```

### Database Helper
```typescript
// test/helpers/db.ts
export async function cleanDatabase() {
  await db.delete(captures);
  await db.delete(jobs);
  await db.delete(user).where(eq(user.role, 'user')); // Keep superuser
}

export async function seedTestData() {
  const user = await createTestUser('user');
  const capture = await createTestCapture(user.id);
  return { user, capture };
}
```

### Factory Helper
```typescript
// test/helpers/factory.ts
export function createTestUser(role: UserRole = 'user') {
  return {
    email: `test-${randomId()}@test.com`,
    password: 'password123',
    role,
    name: 'Test User',
  };
}
```

## When to Write Tests

### ALWAYS test:
- ✅ New RBAC logic
- ✅ Permission checks
- ✅ Data transformations
- ✅ Critical API endpoints

### SOMETIMES test:
- ⚠️ CRUD endpoints (if logic is simple, skip)
- ⚠️ Validation (if using Zod, may not need explicit tests)

### RARELY test:
- ❌ Boilerplate code
- ❌ Type definitions
- ❌ Simple getters/setters

## Summary

**Testing Philosophy:**
- Focus on **critical business logic** and **integration points**
- Aim for **40-50% overall coverage**, **70-80% for critical code**
- Use **real database/Redis** for integration tests
- **Don't over-test** - pragmatic approach for a self-hosted tool
- **Trust your dependencies** - Fastify, Drizzle, Better Auth are tested

**Test Priority:**
1. 🔴 HIGH: RBAC, auth, permissions (unit + integration)
2. 🟡 MEDIUM: API endpoints, database operations (integration)
3. 🟢 LOW: E2E workflows (optional)

This approach balances **confidence in critical code** with **development velocity**.
