# Justfile for AutoPWN - Complete replacement for npm scripts and bash scripts

# Default task
default:
    @just --list

# BUILDING
# Build the entire project
build:
    @pnpm build

# Build the test container
build-test:
    @docker build -f Dockerfile.test -t autopwn/test-runner .

# DEVELOPMENT
# Start development environment
dev:
    @pnpm dev

# Start test development environment
dev-test:
    @dotenv -e .env.test -- pnpm --filter @autopwn/api test:dev

# TESTING INFRASTRUCTURE
# Start the test infrastructure
test-infra-up:
    @echo "Starting test infrastructure..."
    @docker compose -f docker-compose.test.runner.yml up -d --build

# Clean up test infrastructure
test-cleanup:
    @echo "Cleaning up test infrastructure..."
    @docker compose -f docker-compose.test.runner.yml down -v
    @docker volume rm autopwn_postgres_test_data autopwn_redis_test_data 2>/dev/null || true
    @docker network rm autopwn-test-network 2>/dev/null || true

# Force cleanup
test-cleanup-force:
    @docker compose -f docker-compose.test.runner.yml down -v --remove-orphans
    @docker ps -aq --filter "name=autopwn-" | xargs -r docker rm -f 2>/dev/null || true
    @docker volume ls -q --filter "name=autopwn_" | xargs -r docker volume rm 2>/dev/null || true

# Show test logs
test-logs:
    @docker compose -f docker-compose.test.runner.yml logs -f

# TESTING - New Vitest + Testcontainers Setup

# Run all tests (unit + integration)
test:
    @pnpm test

# Run unit tests only
test-unit:
    @pnpm test:unit

# Run integration tests only
test-integration:
    @pnpm test:integration

# Run tests with coverage
test-coverage:
    @pnpm test:coverage

# Run tests in watch mode
test-watch:
    @pnpm test:watch

# Run tests with UI
test-ui:
    @pnpm test:ui

# API specific tests
test-api:
    @pnpm test:unit --filter @autopwn/api

test-api-integration:
    @pnpm test:integration --filter @autopwn/api

test-api-performance:
    @pnpm test:performance --filter @autopwn/api

# Web app specific tests
test-web:
    @pnpm test:unit --filter web

test-web-integration:
    @pnpm test:integration --filter web

# E2E Tests (Playwright)
test-e2e:
    @pnpm test:e2e

test-e2e-ui:
    @pnpm test:e2e:ui

test-e2e-debug:
    @pnpm test:e2e:debug

test-e2e-headed:
    @pnpm test:e2e:headed

test-e2e-chromium:
    @pnpm test:e2e:chromium

install-e2e:
    @pnpm test:e2e:install

# Performance testing
test-perf:
    @pnpm test:performance

# Full CI test suite
test-ci:
    @pnpm test:ci

# LEGACY TESTING (Docker Compose - kept for compatibility)

# Quick test run (assumes infrastructure is already up)
test-quick:
    @docker compose -f docker-compose.test.runner.yml run --rm test-runner sh -c "pnpm test:db:migrate && pnpm test:e2e"

# Restart test infrastructure
test-restart: test-cleanup test-compose

# Run full test suite with original bash script (deprecated but kept for reference)
test-full-legacy:
    @bash ./scripts/test-runner.sh

# Run CI tests
test-ci:
    @CLEANUP_ON_FAILURE=false bash ./scripts/test-runner.sh

# Run tests without cleanup
test-no-cleanup:
    @CLEANUP_ON_SUCCESS=false CLEANUP_ON_FAILURE=false bash ./scripts/test-runner.sh

# Database operations for testing
test-db-migrate:
    @dotenv -e .env.test -- turbo test:migrate

test-db-push:
    @dotenv -e .env.test -- turbo test:db:push

test-db-seed:
    @dotenv -e .env.test -- turbo test:seed

# INFRASTRUCTURE
# Start test services
test-infra-start:
    @docker compose -f docker-compose.test.yml up -d

# Stop test services
test-infra-stop:
    @docker compose -f docker-compose.test.yml down

# Restart test services
test-infra-restart:
    @docker compose -f docker-compose.test.yml down && docker compose -f docker-compose.test.yml up -d

# Show test services logs
test-infra-logs:
    @docker compose -f docker-compose.test.yml logs -f

# UTILITIES
# Install Playwright browsers
test-e2e-install:
    @dotenv -e .env.test -- turbo test:e2e:install

# Run e2e tests with UI
test-e2e-ui:
    @dotenv -e .env.test -- turbo test:e2e:ui

# Run e2e tests in debug mode
test-e2e-debug:
    @dotenv -e .env.test -- turbo test:e2e:debug

# Run e2e tests in headed mode
test-e2e-headed:
    @dotenv -e .env.test -- turbo test:e2e:headed

# Run e2e tests with Chromium
test-e2e-chromium:
    @dotenv -e .env.test -- turbo test:e2e:chromium

# Show test report
test-e2e-report:
    @dotenv -e .env.test -- turbo test:e2e:report

# Linting and formatting
lint:
    @pnpm lint

format:
    @pnpm format

# Cleanup old volumes
test-cleanup-volumes:
    @bash ./scripts/cleanup-old-volumes.sh

# API development
test-api-dev:
    @dotenv -e .env.test -- turbo test:dev --filter=@autopwn/api

# Web development  
test-web-dev:
    @dotenv -e .env.test -- turbo test:dev --filter=web