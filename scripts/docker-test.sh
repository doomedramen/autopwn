#!/bin/bash

# AutoPWN Docker Test Environment Script
# Provides convenient commands for managing the testing environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed. Please install docker-compose first."
        exit 1
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
AutoPWN Docker Test Environment

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start           Start test environment (database, redis, test-runner)
    stop            Stop test environment
    restart         Restart test environment
    setup           Set up test database (migrate and seed)
    unit            Run unit tests
    integration     Run integration tests
    performance     Run performance tests
    all             Run all tests
    logs [service]  Show logs for specific service
    shell [service] Open shell in specific service container
    db              Open test database shell
    redis           Open test redis shell
    status          Show status of all services
    clean           Remove containers and volumes (destructive!)
    rebuild         Rebuild test Docker images

Examples:
    $0 start                    # Start test environment
    $0 setup                    # Setup test database
    $0 unit                     # Run unit tests
    $0 integration              # Run integration tests
    $0 all                     # Run all tests
    $0 shell test-runner        # Open shell in test runner
    $0 clean                    # Clean up everything (destructive!)

EOF
}

# Main script logic
check_docker
check_docker_compose

COMMAND=${1:-help}

case "$COMMAND" in
    "start")
        print_status "Starting AutoPWN test environment..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml --profile integration-test up -d
        print_success "Test environment started!"
        print_status "Services:"
        echo "  - Database: localhost:5433"
        echo "  - Redis: localhost:6380"
        echo "  - Test Runner: autopwn-test-runner"
        ;;
    "stop")
        print_status "Stopping AutoPWN test environment..."
        docker-compose -f docker-compose.test.yml down
        print_success "Test environment stopped!"
        ;;
    "restart")
        print_status "Restarting AutoPWN test environment..."
        docker-compose -f docker-compose.test.yml down
        NODE_ENV=test docker-compose -f docker-compose.test.yml --profile integration-test up -d
        print_success "Test environment restarted!"
        ;;
    "setup")
        print_status "Setting up test database..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml --profile db-setup up
        print_success "Test database setup completed!"
        ;;
    "unit")
        print_status "Running unit tests..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml run --rm test-runner pnpm test:unit
        print_success "Unit tests completed!"
        ;;
    "integration")
        print_status "Running integration tests..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml run --rm test-runner pnpm test:integration
        print_success "Integration tests completed!"
        ;;
    "performance")
        print_status "Running performance tests..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml run --rm test-runner pnpm test:performance
        print_success "Performance tests completed!"
        ;;
    "all")
        print_status "Running all tests..."
        NODE_ENV=test docker-compose -f docker-compose.test.yml run --rm test-runner pnpm test
        print_success "All tests completed!"
        ;;
    "logs")
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose -f docker-compose.test.yml logs -f
        else
            docker-compose -f docker-compose.test.yml logs -f "$SERVICE"
        fi
        ;;
    "shell")
        SERVICE=${2:-test-runner}
        print_status "Opening shell in $SERVICE container..."
        docker-compose -f docker-compose.test.yml exec "$SERVICE" sh
        ;;
    "db")
        print_status "Opening test PostgreSQL shell..."
        docker-compose -f docker-compose.test.yml exec database psql -U postgres -d autopwn_test
        ;;
    "redis")
        print_status "Opening test Redis shell..."
        docker-compose -f docker-compose.test.yml exec redis redis-cli
        ;;
    "status")
        print_status "AutoPWN Test Environment Status:"
        docker-compose -f docker-compose.test.yml ps
        ;;
    "clean")
        print_warning "This will remove all test containers and volumes!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleaning up AutoPWN test environment..."
            docker-compose -f docker-compose.test.yml down -v --remove-orphans
            docker system prune -f
            print_success "Test cleanup completed!"
        else
            print_status "Test cleanup cancelled."
        fi
        ;;
    "rebuild")
        print_status "Rebuilding test Docker images..."
        docker-compose -f docker-compose.test.yml build --no-cache
        print_success "Test Docker images rebuilt!"
        ;;
    "help"|*)
        show_usage
        ;;
esac