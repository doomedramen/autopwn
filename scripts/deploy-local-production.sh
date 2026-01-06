#!/bin/bash

# CrackHouse Local Production Deployment Script
# This script deploys a production-like setup locally for testing

set -e  # Exit on any error

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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        print_error "docker-compose or docker compose is not available."
        exit 1
    fi

    # Use docker compose if available, otherwise docker-compose
    if command -v docker-compose > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi

    print_success "Using $COMPOSE_CMD"
}

# Check environment variables
check_env() {
    if [ ! -f ".env.production.local" ]; then
        print_error ".env.production.local file not found. Please create it from .env.example"
        exit 1
    fi

    # Check for required environment variables
    source .env.production.local

    if [ -z "$AUTH_SECRET" ] || [ "$AUTH_SECRET" = "GENERATE_SECURE_32_CHAR_SECRET_HERE_CHANGE_ME" ]; then
        print_warning "AUTH_SECRET is not set or using default value. Please update it for security."
    fi

    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "GENERATE_SECURE_32_CHAR_JWT_SECRET_HERE_CHANGE_ME" ]; then
        print_warning "JWT_SECRET is not set or using default value. Please update it for security."
    fi

    print_success "Environment file checked"
}

# Build and start services
deploy_services() {
    print_status "Building and starting production services..."

    # Stop any existing services
    $COMPOSE_CMD -f docker-compose.local.yml down --remove-orphans || true

    # Build and start services
    $COMPOSE_CMD -f docker-compose.local.yml up --build -d

    print_success "Services deployed successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."

    # Wait for database
    print_status "Waiting for database..."
    timeout 60 bash -c 'until docker exec crackhouse-db-prod-local pg_isready -U postgres; do sleep 2; done'

    # Wait for Redis
    print_status "Waiting for Redis..."
    timeout 30 bash -c 'until docker exec crackhouse-redis-prod-local redis-cli ping; do sleep 2; done'

    # Wait for API
    print_status "Waiting for API..."
    timeout 120 bash -c 'until curl -f http://localhost:3001/health; do sleep 5; done'

    # Wait for Web
    print_status "Waiting for Web..."
    timeout 120 bash -c 'until curl -f http://localhost:3000; do sleep 5; done'

    print_success "All services are healthy"
}

# Show service status
show_status() {
    print_status "Service status:"
    $COMPOSE_CMD -f docker-compose.local.yml ps

    echo ""
    print_status "Service URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  API: http://localhost:3001"
    echo "  API Health: http://localhost:3001/health"
    echo "  Database Admin: http://localhost:1337 (if enabled)"
    echo "  Nginx Health: http://localhost/health"
}

# Show logs
show_logs() {
    print_status "Recent logs:"
    $COMPOSE_CMD -f docker-compose.local.yml logs --tail=20
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    $COMPOSE_CMD -f docker-compose.local.yml down --remove-orphans
    print_success "Cleanup completed"
}

# Show usage
usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     Build and deploy all services (default)"
    echo "  status     Show service status"
    echo "  logs       Show recent logs"
    echo "  health     Check service health"
    echo "  cleanup    Stop and remove all services"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy    # Deploy all services"
    echo "  $0 status    # Check service status"
    echo "  $0 logs      # Show logs"
    echo "  $0 cleanup   # Stop all services"
}

# Main script logic
main() {
    local command=${1:-deploy}

    case $command in
        "deploy")
            check_docker
            check_docker_compose
            check_env
            deploy_services
            wait_for_services
            show_status
            print_success "Production deployment completed successfully!"
            echo ""
            print_status "To view logs: $0 logs"
            print_status "To check status: $0 status"
            print_status "To stop services: $0 cleanup"
            ;;
        "status")
            check_docker_compose
            show_status
            ;;
        "logs")
            check_docker_compose
            show_logs
            ;;
        "health")
            check_docker_compose
            print_status "Checking service health..."

            # Check each service
            services=("database:5432" "redis:6379" "api:3001" "web:3000" "nginx:80")
            for service in "${services[@]}"; do
                IFS=':' read -r name port <<< "$service"
                if curl -f "http://localhost:$port/health" > /dev/null 2>&1 || [ "$name" = "database" ] || [ "$name" = "redis" ]; then
                    print_success "$name is healthy"
                else
                    print_error "$name is not healthy"
                fi
            done
            ;;
        "cleanup")
            check_docker_compose
            cleanup
            ;;
        "help"|"-h"|"--help")
            usage
            ;;
        *)
            print_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"