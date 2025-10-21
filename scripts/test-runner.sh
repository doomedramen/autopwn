#!/usr/bin/env bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
PROJECT_NAME="autopwn-test"
CLEANUP_ON_SUCCESS="${CLEANUP_ON_SUCCESS:-true}"
CLEANUP_ON_FAILURE="${CLEANUP_ON_FAILURE:-true}"

# Trap to ensure cleanup on exit
cleanup() {
    local exit_code=$?

    echo ""
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}Cleaning up test environment...${NC}"
    echo -e "${BLUE}==================================================${NC}"

    # Determine if we should cleanup based on exit code
    local should_cleanup=false
    if [ $exit_code -eq 0 ] && [ "$CLEANUP_ON_SUCCESS" = "true" ]; then
        should_cleanup=true
        echo -e "${GREEN}Tests passed. Cleaning up...${NC}"
    elif [ $exit_code -ne 0 ] && [ "$CLEANUP_ON_FAILURE" = "true" ]; then
        should_cleanup=true
        echo -e "${YELLOW}Tests failed. Cleaning up...${NC}"
    elif [ $exit_code -ne 0 ]; then
        echo -e "${YELLOW}Tests failed. Preserving environment for debugging.${NC}"
        echo -e "${YELLOW}To clean up manually, run: pnpm test:cleanup${NC}"
    fi

    if [ "$should_cleanup" = "true" ]; then
        # Stop and remove containers
        echo -e "${BLUE}Stopping containers...${NC}"
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

        # Remove volumes
        echo -e "${BLUE}Removing volumes...${NC}"
        docker volume rm autopwn_postgres_test_data 2>/dev/null || true
        docker volume rm autopwn_redis_test_data 2>/dev/null || true

        # Remove network
        echo -e "${BLUE}Removing network...${NC}"
        docker network rm autopwn-test-network 2>/dev/null || true

        echo -e "${GREEN}✓ Cleanup complete${NC}"
    fi

    exit $exit_code
}

# Function to wait for services to be healthy
wait_for_services() {
    echo -e "${BLUE}Waiting for services to be healthy...${NC}"

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local postgres_healthy=$(docker inspect --format='{{.State.Health.Status}}' autopwn-postgres-test 2>/dev/null || echo "not_found")
        local redis_healthy=$(docker inspect --format='{{.State.Health.Status}}' autopwn-redis-test 2>/dev/null || echo "not_found")

        if [ "$postgres_healthy" = "healthy" ] && [ "$redis_healthy" = "healthy" ]; then
            echo -e "${GREEN}✓ All services are healthy${NC}"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -e "${YELLOW}⏳ Waiting... (attempt $attempt/$max_attempts) [Postgres: $postgres_healthy, Redis: $redis_healthy]${NC}"
        sleep 2
    done

    echo -e "${RED}✗ Services failed to become healthy after $max_attempts attempts${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    docker compose -f "$COMPOSE_FILE" logs
    return 1
}

# Register cleanup trap
trap cleanup EXIT INT TERM

# Main execution
main() {
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}AutoPWN Test Runner${NC}"
    echo -e "${BLUE}==================================================${NC}"
    echo ""

    # Step 1: Clean up any existing test infrastructure
    echo -e "${BLUE}Step 1/5: Cleaning up existing test infrastructure...${NC}"
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    docker volume rm autopwn_postgres_test_data 2>/dev/null || true
    docker volume rm autopwn_redis_test_data 2>/dev/null || true
    docker network rm autopwn-test-network 2>/dev/null || true
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    echo ""

    # Step 2: Start test infrastructure
    echo -e "${BLUE}Step 2/5: Starting test infrastructure...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d
    echo -e "${GREEN}✓ Infrastructure started${NC}"
    echo ""

    # Step 3: Wait for services to be healthy
    echo -e "${BLUE}Step 3/5: Waiting for services to be ready...${NC}"
    wait_for_services
    echo ""

    # Step 4: Run database migrations/setup
    echo -e "${BLUE}Step 4/5: Setting up database...${NC}"
    NODE_ENV=test pnpm --filter @autopwn/api test:db:push || {
        echo -e "${YELLOW}Database push failed or not needed, continuing...${NC}"
    }
    NODE_ENV=test pnpm --filter @autopwn/api test:seed || {
        echo -e "${YELLOW}Database seed failed, continuing...${NC}"
    }
    echo -e "${GREEN}✓ Database ready${NC}"
    echo ""

    # Step 5: Run tests
    echo -e "${BLUE}Step 5/5: Running e2e tests...${NC}"
    echo ""

    # Run the actual test command passed as arguments, or default to test:e2e
    if [ $# -eq 0 ]; then
        dotenv -e .env.test -- turbo test:e2e
    else
        "$@"
    fi

    local test_exit_code=$?

    echo ""
    if [ $test_exit_code -eq 0 ]; then
        echo -e "${GREEN}==================================================${NC}"
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo -e "${GREEN}==================================================${NC}"
    else
        echo -e "${RED}==================================================${NC}"
        echo -e "${RED}✗ Tests failed${NC}"
        echo -e "${RED}==================================================${NC}"
    fi

    return $test_exit_code
}

# Run main function with all arguments
main "$@"
