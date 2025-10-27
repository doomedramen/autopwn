#!/bin/bash

# E2E Test Runner Script
# Manages server lifecycle and provides reliable E2E testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 AutoPWN E2E Test Runner${NC}"
echo "=================================="

# Configuration
DATABASE_URL="${DATABASE_URL:-"postgresql://postgres:password@localhost:5432/autopwn_test"}"
BASE_URL="${BASE_URL:-"http://localhost:3000"}"
NODE_ENV="${NODE_ENV:-test}"
PROJECT="${PROJECT:-}"  # Leave empty for all projects
HEADED="${HEADED:-false}"  # Whether to run tests in headed mode

# Function to cleanup processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up processes...${NC}"

    # Kill processes on ports 3000 and 3001
    lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true

    # Kill any remaining dev/test processes
    pkill -f "test:dev\|next dev" 2>/dev/null || true
    pkill -f "playwright test" 2>/dev/null || true

    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to start servers
start_servers() {
    echo -e "${BLUE}🚀 Starting development servers...${NC}"

    # Start API server in background
    echo "Starting API server..."
    cd "$(dirname "$0")/.."
    DATABASE_URL="$DATABASE_URL" NODE_ENV="$NODE_ENV" pnpm --filter @autopwn/api test:dev &
    API_PID=$!

    # Wait for API server to be ready
    echo "Waiting for API server..."
    timeout 60 bash -c 'until curl -f http://localhost:3001/health; do sleep 1; done'
    echo -e "${GREEN}✅ API server ready${NC}"

    # Start Web server in background
    echo "Starting Web server..."
    DATABASE_URL="$DATABASE_URL" NODE_ENV="$NODE_ENV" BASE_URL="$BASE_URL" pnpm --filter web test:dev &
    WEB_PID=$!

    # Wait for Web server to be ready
    echo "Waiting for Web server..."
    timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 1; done'
    echo -e "${GREEN}✅ Web server ready${NC}"

    # Store PIDs for cleanup
    echo "$API_PID" > /tmp/e2e-api-pid
    echo "$WEB_PID" > /tmp/e2e-web-pid

    echo -e "${GREEN}✅ All servers started${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}🧪 Running E2E tests...${NC}"

    cd "$(dirname "$0")/.."

    # Set environment variables for tests
    export DATABASE_URL="$DATABASE_URL"
    export BASE_URL="$BASE_URL"
    export NODE_ENV="$NODE_ENV"
    export SKIP_WEB_SERVER="true"

    # Build test command
    TEST_CMD="pnpm test:e2e"
    if [ -n "$PROJECT" ]; then
        TEST_CMD="$TEST_CMD -- --project=$PROJECT"
    fi
    if [ "$HEADED" = "true" ]; then
        TEST_CMD="$TEST_CMD -- --headed"
        echo -e "${YELLOW}🎬 Running tests in headed mode (browser will be visible)${NC}"
    fi

    echo "Running: $TEST_CMD"
    $TEST_CMD
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --project PROJECT    Run tests for specific project (chromium, firefox, webkit)"
    echo "  -c, --cleanup-only      Only cleanup processes, don't run tests"
    echo "      --headed            Run tests in headed mode (browser visible)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL           Database connection URL"
    echo "  BASE_URL              Web server base URL"
    echo "  NODE_ENV              Node environment (default: test)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 -p chromium                        # Run Chromium tests only"
    echo "  $0 --headed                           # Run all tests in headed mode"
    echo "  $0 -p chromium --headed              # Run Chromium tests in headed mode"
    echo "  DATABASE_URL=custom://db $0           # Use custom database"
}

# Parse command line arguments
CLEANUP_ONLY=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            PROJECT="$2"
            shift 2
            ;;
        -c|--cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        --headed)
            HEADED="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Main execution
trap cleanup EXIT

# Initial cleanup
cleanup

if [ "$CLEANUP_ONLY" = true ]; then
    echo -e "${GREEN}✅ Cleanup completed${NC}"
    exit 0
fi

# Start servers
start_servers

# Run tests
if run_tests; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ E2E testing completed successfully${NC}"