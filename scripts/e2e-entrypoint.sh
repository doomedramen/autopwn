#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-60}
    local attempt=0

    log "Waiting for $name to be ready..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log "$name is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    error "$name failed to start within ${max_attempts}s"
    return 1
}

# Function to cleanup background processes
cleanup() {
    log "Shutting down services..."
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Initialize database (Postgres and Redis are already healthy via docker-compose healthcheck)
log "Initializing database..."

cd /crackhouse/apps/api
log "Pushing database schema..."
npx drizzle-kit push --force || error "Database schema push failed"

# Seed database for testing
log "Seeding database..."
npx tsx src/db/seed-superuser.ts || log "Superuser seed skipped (may already exist)"
npx tsx src/db/seed-config.ts || log "Config seed skipped (may already exist)"

# Start API server in background
log "Starting API server on port 3001..."
NODE_ENV=test REDIS_URL="${REDIS_URL:-redis://localhost:6380}" \
    npx tsx src/index.ts > /tmp/api.log 2>&1 &
API_PID=$!
echo $API_PID > /tmp/api.pid

# Start worker in background
log "Starting worker..."
NODE_ENV=test REDIS_URL="${REDIS_URL:-redis://localhost:6380}" \
    npx tsx src/workers/index.ts > /tmp/worker.log 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > /tmp/worker.pid

# Start web server in background
log "Starting web server on port 3000..."
cd /crackhouse/apps/web
NODE_ENV=test NEXT_PUBLIC_API_URL="http://localhost:3001" \
    BASE_URL="http://localhost:3000" \
    npx next start --port 3000 > /tmp/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > /tmp/web.pid

# Wait for services to be ready
wait_for_service "http://localhost:3001/health" "API"
wait_for_service "http://localhost:3000" "Web"

# Show service logs if something goes wrong
show_logs_on_error() {
    log "=== API Log ==="
    cat /tmp/api.log 2>/dev/null || echo "No API log"
    log "=== Worker Log ==="
    cat /tmp/worker.log 2>/dev/null || echo "No worker log"
    log "=== Web Log ==="
    cat /tmp/web.log 2>/dev/null || echo "No web log"
}

trap show_logs_on_error ERR

# Run E2E tests
TEST_PATTERN="${E2E_TEST_PATTERN:-tests/specs/integration.spec.ts}"
log "Starting E2E tests (pattern: $TEST_PATTERN)..."
cd /crackhouse/apps/web
NODE_ENV=test BASE_URL="http://localhost:3000" \
    npx playwright test "$TEST_PATTERN" --reporter=list

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log "✅ All tests passed!"
else
    error "❌ Tests failed with exit code $TEST_EXIT_CODE"
    show_logs_on_error
fi

exit $TEST_EXIT_CODE
