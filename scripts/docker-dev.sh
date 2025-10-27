#!/bin/bash

# AutoPWN Docker Development Environment Script
# Provides convenient commands for managing the development environment

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
AutoPWN Docker Development Environment

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start           Start development environment (api, web, database, redis)
    stop            Stop development environment
    restart         Restart development environment
    logs            Show logs for all services
    logs [service]  Show logs for specific service (api, web, database, redis)
    shell [service] Open shell in specific service container
    db              Open database shell
    redis           Open redis shell
    status          Show status of all services
    clean           Remove containers and volumes (destructive!)
    rebuild         Rebuild all Docker images
    tools           Start administration tools (adminer, redis-commander)

Examples:
    $0 start                    # Start all services
    $0 logs api                 # Show API logs
    $0 shell api                # Open shell in API container
    $0 db                      # Open PostgreSQL shell
    $0 clean                    # Clean up everything (destructive!)

EOF
}

# Main script logic
check_docker
check_docker_compose

COMMAND=${1:-help}

case "$COMMAND" in
    "start")
        print_status "Starting AutoPWN development environment..."
        NODE_ENV=development docker-compose --profile dev up -d
        print_success "Development environment started!"
        print_status "Services:"
        echo "  - API: http://localhost:3001"
        echo "  - Web: http://localhost:3000"
        echo "  - Database: localhost:5432"
        echo "  - Redis: localhost:6379"
        echo "  - Health checks:"
        echo "    API: http://localhost:3001/health"
        echo "    Web: http://localhost:3000"
        ;;
    "stop")
        print_status "Stopping AutoPWN development environment..."
        docker-compose down
        print_success "Development environment stopped!"
        ;;
    "restart")
        print_status "Restarting AutoPWN development environment..."
        docker-compose --profile dev down
        NODE_ENV=development docker-compose --profile dev up -d
        print_success "Development environment restarted!"
        ;;
    "logs")
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose --profile dev logs -f
        else
            docker-compose --profile dev logs -f "$SERVICE"
        fi
        ;;
    "shell")
        SERVICE=${2:-api}
        if [ -z "$SERVICE" ]; then
            print_error "Please specify a service: api, web, database, redis"
            exit 1
        fi
        print_status "Opening shell in $SERVICE container..."
        docker-compose exec "$SERVICE" sh
        ;;
    "db")
        print_status "Opening PostgreSQL shell..."
        docker-compose exec database psql -U postgres -d autopwn_development
        ;;
    "redis")
        print_status "Opening Redis shell..."
        docker-compose exec redis redis-cli
        ;;
    "status")
        print_status "AutoPWN Development Environment Status:"
        docker-compose --profile dev ps
        ;;
    "clean")
        print_warning "This will remove all containers, volumes, and images!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleaning up AutoPWN development environment..."
            docker-compose --profile dev down -v --remove-orphans
            docker system prune -f
            print_success "Cleanup completed!"
        else
            print_status "Cleanup cancelled."
        fi
        ;;
    "rebuild")
        print_status "Rebuilding Docker images..."
        docker-compose --profile dev build --no-cache
        print_success "Docker images rebuilt!"
        ;;
    "tools")
        print_status "Starting administration tools..."
        NODE_ENV=development docker-compose --profile tools up -d
        print_success "Administration tools started!"
        print_status "Services:"
        echo "  - Adminer (DB Admin): http://localhost:8080"
        echo "  - Redis Commander: http://localhost:8081"
        ;;
    "help"|*)
        show_usage
        ;;
esac