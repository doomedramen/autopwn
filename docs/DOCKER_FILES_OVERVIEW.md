# Docker Files Overview

This document explains the purpose of each Docker and Docker Compose file in the AutoPWN project.

## Docker Compose Files

### `docker-compose.yml` (Default - Full Stack)
**Purpose:** Complete development stack with all services

**Services:**
- PostgreSQL database
- Redis (caching + queues)
- API server (Hono)
- Worker (BullMQ background jobs)
- Web frontend (Next.js)
- Adminer (database GUI)
- Redis Commander (Redis GUI)

**Use Case:**
```bash
# Start entire stack for local development
docker-compose up -d

# Access services:
# - API: http://localhost:3001
# - Web: http://localhost:3000
# - Adminer: http://localhost:8080
# - Redis Commander: http://localhost:8081
```

**When to use:**
- Full stack development
- Testing complete application flow
- Demo purposes
- When you want everything running in Docker

---

### `docker-compose.dev.yml` (Infrastructure Only)
**Purpose:** Database and Redis only for local development

**Services:**
- PostgreSQL database
- Redis (caching + queues)
- **Optional** (with `--profile tools`):
  - PgAdmin (database GUI)
  - Redis Commander (Redis GUI)
  - Mailhog (email testing)

**Use Case:**
```bash
# Start only infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Run application locally (outside Docker)
pnpm --filter @autopwn/api dev
pnpm --filter @autopwn/web dev
```

**When to use:**
- Prefer running app locally with hot reload
- Need database + Redis but want to run app natively
- Faster iteration during development
- **Recommended for most development work**

---

### `docker-compose.test.yml` (Testing)
**Purpose:** Fast, isolated testing with tmpfs storage

**Services:**
- PostgreSQL (tmpfs - ephemeral, fast)
- Redis (tmpfs - ephemeral, fast)
- **Profiles:**
  - `manual-test`: Test runner container
  - `e2e-test`: Full E2E test stack (API + Web + E2E runner)
  - `db-setup`: Database migration and seeding

**Use Case:**
```bash
# Integration tests with real DB/Redis
docker-compose -f docker-compose.test.yml up -d database redis
pnpm test:integration:real
docker-compose -f docker-compose.test.yml down -v

# E2E tests
docker-compose -f docker-compose.test.yml --profile e2e-test up -d
docker-compose -f docker-compose.test.yml exec e2e-test pnpm test:e2e
docker-compose -f docker-compose.test.yml down -v
```

**When to use:**
- Integration testing
- E2E testing
- CI/CD pipelines (locally)
- Fast test execution with tmpfs

---

### `docker-compose.ci.yml` (Continuous Integration)
**Purpose:** Optimized for CI/CD environments

**Services:**
- PostgreSQL (tmpfs)
- Redis (tmpfs)
- Test runner (unit + integration tests)
- **Profiles:**
  - `unit-tests`: Unit tests only
  - `integration-tests`: Integration tests
  - `performance-tests`: Performance benchmarks
  - `e2e-tests`: End-to-end tests with full stack

**Use Case:**
```bash
# In GitHub Actions / GitLab CI
docker-compose -f docker-compose.ci.yml up -d database redis
docker-compose -f docker-compose.ci.yml run --rm test-runner
```

**When to use:**
- GitHub Actions workflows
- GitLab CI pipelines
- Local CI simulation
- Automated testing pipelines

---

### `docker-compose.prod.yml` (Production)
**Purpose:** Production deployment with security hardening

**Services:**
- PostgreSQL (persistent, hardened)
- Redis (persistent, password-protected)
- API server (read-only, resource limits)
- Worker (background jobs, isolated)
- Web frontend (read-only, resource limits)
- **Optional** (with `--profile with-proxy`):
  - Nginx reverse proxy with SSL

**Use Case:**
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# With Nginx reverse proxy
docker-compose -f docker-compose.prod.yml --env-file .env.production --profile with-proxy up -d
```

**When to use:**
- Production deployments
- Staging environments
- Production-like testing
- **Requires proper environment variables**

---

## Comparison Matrix

| Feature | default | dev | test | ci | prod |
|---------|---------|-----|------|----|----|
| **Full Stack** | ✅ | ❌ | Partial | Partial | ✅ |
| **API Service** | ✅ | ❌ | Profile | Profile | ✅ |
| **Web Service** | ✅ | ❌ | Profile | Profile | ✅ |
| **Database** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Redis** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Persistence** | ✅ | ✅ | ❌ tmpfs | ❌ tmpfs | ✅ |
| **Security** | Basic | Basic | Medium | Medium | Maximum |
| **Resource Limits** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Dev Tools** | ✅ | Profile | ❌ | ❌ | ❌ |
| **Hot Reload** | ❌ | N/A | N/A | N/A | ❌ |

---

## Dockerfile Files

### `Dockerfile` (API Service)
Multi-stage build for API server

**Stages:**
- `base`: Dependencies installation
- `development`: Development with source maps
- `test`: Testing with test dependencies
- `ci`: CI optimized build
- `production`: Optimized production build (no dev deps)

**Usage:**
```bash
# Development
docker build --target development -t autopwn-api:dev .

# Production
docker build --target production -t autopwn-api:latest .
```

---

### `Dockerfile.web` (Web Frontend)
Multi-stage build for Next.js frontend

**Stages:**
- `base`: Dependencies installation
- `development`: Development with hot reload
- `test`: Testing configuration
- `ci`: CI optimized build
- `production`: Optimized production build with standalone output

**Usage:**
```bash
# Development
docker build -f Dockerfile.web --target development -t autopwn-web:dev .

# Production
docker build -f Dockerfile.web --target production -t autopwn-web:latest .
```

---

### `Dockerfile.test` (Test Runner)
Optimized for running tests in containers

**Stages:**
- `base`: Test dependencies
- `development`: Development test runner
- `integration-test`: Integration test runner
- `unit-test`: Unit test runner
- `performance-test`: Performance test runner

**Usage:**
```bash
# Build test image
docker build -f Dockerfile.test -t autopwn-test:latest .

# Run tests
docker run --rm autopwn-test:latest pnpm test:unit
```

---

### `Dockerfile.e2e` (E2E Tests)
Playwright-based end-to-end testing

**Includes:**
- Chromium browser
- Playwright dependencies
- Test utilities
- Screenshot/video recording support

**Usage:**
```bash
# Build E2E image
docker build -f Dockerfile.e2e -t autopwn-e2e:latest .

# Run E2E tests
docker run --rm -v ./test-results:/app/test-results autopwn-e2e:latest pnpm test:e2e
```

---

### `Dockerfile.ci` (CI Runner)
Lightweight CI environment

**Optimized for:**
- Fast builds
- Minimal image size
- CI/CD pipelines
- Parallel test execution

**Usage:**
```bash
# Build CI image
docker build -f Dockerfile.ci -t autopwn-ci:latest .
```

---

## Recommended Workflows

### Local Development (Recommended)
```bash
# 1. Start infrastructure only
docker-compose -f docker-compose.dev.yml up -d

# 2. Run app locally with hot reload
pnpm --filter @autopwn/api dev       # Terminal 1
pnpm --filter @autopwn/web dev       # Terminal 2

# 3. Optional: Start development tools
docker-compose -f docker-compose.dev.yml --profile tools up -d
# Access PgAdmin: http://localhost:8080
# Access Redis Commander: http://localhost:8081
# Access Mailhog: http://localhost:8025
```

### Full Stack in Docker
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

### Testing
```bash
# Unit tests (no Docker needed)
pnpm test:unit

# Integration tests
docker-compose -f docker-compose.test.yml up -d database redis
pnpm test:integration:real
docker-compose -f docker-compose.test.yml down -v

# E2E tests
docker-compose -f docker-compose.test.yml --profile e2e-test up -d
docker-compose -f docker-compose.test.yml exec e2e-test pnpm test:e2e
docker-compose -f docker-compose.test.yml down -v
```

### Production Deployment
```bash
# 1. Create .env.production with all required secrets
cp .env.example .env.production
nano .env.production

# 2. Deploy
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 3. Run migrations
docker-compose -f docker-compose.prod.yml exec api pnpm db:migrate

# 4. Create superuser
docker-compose -f docker-compose.prod.yml exec api pnpm db:seed-superuser
```

---

## File Organization

```
/
├── docker-compose.yml          # Default: Full stack
├── docker-compose.dev.yml      # Infrastructure only
├── docker-compose.test.yml     # Testing environment
├── docker-compose.ci.yml       # CI/CD environment
├── docker-compose.prod.yml     # Production deployment
├── Dockerfile                  # API service
├── Dockerfile.web              # Web frontend
├── Dockerfile.test             # Test runner
├── Dockerfile.e2e              # E2E tests
├── Dockerfile.ci               # CI runner
├── .dockerignore               # Docker build exclusions
└── config/
    ├── redis.conf              # Development Redis config
    ├── redis-test.conf         # Testing Redis config
    └── redis-prod.conf         # Production Redis config
```

---

## Quick Reference

| Task | Command |
|------|---------|
| **Start dev infrastructure** | `docker-compose -f docker-compose.dev.yml up -d` |
| **Start full stack** | `docker-compose up -d` |
| **Run integration tests** | `docker-compose -f docker-compose.test.yml up -d database redis` |
| **Run E2E tests** | `docker-compose -f docker-compose.test.yml --profile e2e-test up -d` |
| **Deploy to production** | `docker-compose -f docker-compose.prod.yml --env-file .env.production up -d` |
| **View logs** | `docker-compose logs -f [service]` |
| **Stop all services** | `docker-compose down` |
| **Stop and remove volumes** | `docker-compose down -v` |

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
