# Testing

This directory contains testing infrastructure for CrackHouse.

## E2E Tests

End-to-end tests verify the complete application workflow using Playwright.

### Running E2E Tests

From the repository root:

```bash
# Run all E2E tests
pnpm test:e2e

# Or directly with Docker Compose
docker compose -f testing/docker/docker-compose.e2e.yml up --abort-on-container-exit --build
```

### What the Tests Cover

- User registration and authentication
- PCAP file upload and network extraction
- Dictionary upload
- Job creation and execution
- Password cracking verification

### Test Environment

The E2E test suite spins up:
- PostgreSQL database (port 5433)
- Redis (port 6380)
- API server (port 3001)
- Web server (port 3000)
- Background worker for job processing

All services run in host network mode for simplicity.

### Test Files

Tests are located in `apps/web/tests/specs/`:
- `integration.spec.ts` - Complete end-to-end workflow
- `auth.spec.ts` - Authentication flows
- `upload.spec.ts` - File upload functionality
- `jobs.spec.ts` - Job management
- `dictionaries.spec.ts` - Dictionary management
- `networks.spec.ts` - Network management

### Building the Test Image

```bash
pnpm test:e2e:build
```

## Docker Files

- `docker/Dockerfile.e2e` - Docker image for running E2E tests
- `docker/docker-compose.e2e.yml` - Docker Compose configuration for test environment
