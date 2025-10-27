#!/bin/bash

# AutoPWN Docker Repair Script
# Automated repair for common Docker and environment issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Function to ask for confirmation
confirm_action() {
    local action=$1
    local default=${2:-n}

    if [ "$default" = "y" ]; then
        read -p "$action? [Y/n]: " -n 1 -r
        echo
        [[ $REPLY =~ ^[Nn]$ ]] && return 1 || return 0
    else
        read -p "$action? [y/N]: " -n 1 -r
        echo
        [[ $REPLY =~ ^[Yy]$ ]] && return 0 || return 1
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to stop all containers
stop_all_containers() {
    print_step "Stopping all AutoPWN containers..."

    if docker-compose -f docker-compose.yml ps -q | grep -q .; then
        docker-compose -f docker-compose.yml down
        print_success "Development containers stopped"
    fi

    if docker-compose -f docker-compose.test.yml ps -q | grep -q .; then
        docker-compose -f docker-compose.test.yml down
        print_success "Test containers stopped"
    fi

    # Kill any remaining containers
    remaining_containers=$(docker ps -q --filter "name=autopwn")
    if [ -n "$remaining_containers" ]; then
        docker kill $remaining_containers
        docker rm $remaining_containers
        print_success "Remaining containers cleaned up"
    fi
}

# Function to clean volumes
clean_volumes() {
    print_step "Cleaning Docker volumes..."

    # Remove AutoPWN specific volumes
    autopwn_volumes=$(docker volume ls -q --filter "name=autopwn")
    if [ -n "$autopwn_volumes" ]; then
        print_warning "This will delete all AutoPWN data (volumes)"
        if confirm_action "Continue with volume cleanup" "n"; then
            docker volume rm $autopwn_volumes
            print_success "AutoPWN volumes cleaned"
        else
            print_warning "Volume cleanup skipped"
        fi
    else
        print_success "No AutoPWN volumes to clean"
    fi
}

# Function to clean images
clean_images() {
    print_step "Cleaning Docker images..."

    # Remove AutoPWN images
    autopwn_images=$(docker images -q "autopwn*")
    if [ -n "$autopwn_images" ]; then
        docker rmi $autopwn_images
        print_success "AutoPWN images cleaned"
    fi

    # Clean up dangling images
    dangling_images=$(docker images -f "dangling=true" -q)
    if [ -n "$dangling_images" ]; then
        docker rmi $dangling_images
        print_success "Dangling images cleaned"
    fi
}

# Function to repair permissions
repair_permissions() {
    print_step "Repairing file and directory permissions..."

    # Fix upload directory
    if [ -d "uploads" ]; then
        chmod -R 755 uploads
        print_success "Upload directory permissions fixed"

        # Create subdirectories if missing
        mkdir -p uploads/pcap uploads/dictionary
        print_success "Upload subdirectories created"
    else
        mkdir -p uploads/pcap uploads/dictionary
        print_success "Upload directory created with subdirectories"
    fi

    # Fix script permissions
    chmod +x scripts/*.sh
    print_success "Script permissions fixed"
}

# Function to regenerate environment file
regenerate_env() {
    print_step "Regenerating environment configuration..."

    if [ -f ".env.docker" ]; then
        print_warning ".env file exists, backing up to .env.backup"
        cp .env .env.backup
    fi

    if [ -f ".env.docker" ]; then
        cp .env.docker .env
        print_success "Environment file regenerated from .env.docker"
    else
        print_warning ".env.docker not found, creating minimal .env"
        cat > .env << 'EOF'
# AutoPWN Environment Configuration
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/autopwn_development
REDIS_URL=redis://localhost:6379
PORT=3001
AUTH_SECRET=your-secret-key-here-min-32-chars-long-please
JWT_SECRET=your-jwt-secret-here-min-32-chars-long-please
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=100MB
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF
        print_success "Minimal .env file created"
    fi
}

# Function to rebuild Docker images
rebuild_images() {
    print_step "Rebuilding Docker images..."

    print_status "Pruning Docker system..."
    docker system prune -f

    print_status "Rebuilding development images..."
    docker-compose -f docker-compose.yml build --no-cache

    print_success "Docker images rebuilt"
}

# Function to check system health
check_system_health() {
    print_step "Checking system health..."

    issues=0

    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed"
        issues=$((issues + 1))
    elif ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        issues=$((issues + 1))
    else
        print_success "Docker is running"
    fi

    # Check Docker Compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed"
        issues=$((issues + 1))
    else
        print_success "Docker Compose is available"
    fi

    # Check disk space
    if [ -d "." ]; then
        disk_usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
        if [ "$disk_usage" -gt 90 ]; then
            print_error "Disk usage is critically high (${disk_usage}%)"
            issues=$((issues + 1))
        elif [ "$disk_usage" -gt 80 ]; then
            print_warning "Disk usage is high (${disk_usage}%)"
        else
            print_success "Disk usage is normal (${disk_usage}%)"
        fi
    fi

    # Check memory
    if command_exists free; then
        mem_available=$(free -h | awk 'NR==2{printf "%.0f", $7/$2 * 100.0}')
        if [ "$mem_available" -lt 10 ]; then
            print_error "Available memory is critically low (${mem_available}%)"
            issues=$((issues + 1))
        elif [ "$mem_available" -lt 20 ]; then
            print_warning "Available memory is low (${mem_available}%)"
        else
            print_success "Memory is available (${mem_available}%)"
        fi
    fi

    return $issues
}

# Function to show usage
show_usage() {
    cat << 'EOF'
AutoPWN Docker Repair Tool

Usage: $0 [REPAIR_LEVEL]

REPAIR_LEVELS:
    basic       - Basic cleanup (stop containers, clean images)
    full        - Complete reset (include volumes)
    environment  - Regenerate environment files
    permissions - Fix file permissions
    rebuild     - Rebuild Docker images
    auto         - Automatic repair (recommended)
    help        - Show this help message

Examples:
    $0 basic       # Basic cleanup
    $0 full        # Complete reset
    $0 auto        # Automatic repair based on system health

EOF
}

# Main script logic
REPAIR_LEVEL=${1:-help}

case "$REPAIR_LEVEL" in
    "basic")
        print_status "Starting basic repair..."
        stop_all_containers
        clean_images
        repair_permissions
        print_success "Basic repair completed!"
        ;;
    "full")
        print_status "Starting full repair..."
        stop_all_containers
        clean_volumes
        clean_images
        repair_permissions
        print_success "Full repair completed!"
        ;;
    "environment")
        print_status "Repairing environment configuration..."
        regenerate_env
        print_success "Environment repair completed!"
        ;;
    "permissions")
        print_status "Repairing permissions..."
        repair_permissions
        print_success "Permission repair completed!"
        ;;
    "rebuild")
        print_status "Rebuilding Docker images..."
        rebuild_images
        print_success "Docker rebuild completed!"
        ;;
    "auto")
        print_status "Starting automatic repair..."

        health_issues=$(check_system_health)

        if [ "$health_issues" -gt 0 ]; then
            print_warning "System health issues detected, proceeding with automatic repair..."

            stop_all_containers

            if [ "$health_issues" -gt 2 ]; then
                print_warning "Multiple issues detected, performing full repair..."
                clean_volumes
            fi

            clean_images
            repair_permissions

            if [ ! -f ".env" ] || [ ! -s ".env" ]; then
                regenerate_env
            fi

            print_success "Automatic repair completed!"
        else
            print_success "System appears healthy, no repair needed!"
            print_status "Consider running '$0 basic' if you still experience issues"
        fi
        ;;
    "help"|*)
        show_usage
        ;;
esac

# Final recommendations
echo ""
print_status "Repair completed! Next steps:"
echo "1. Start development environment: ./scripts/docker-dev.sh start"
echo "2. Check system health: ./scripts/health-check.sh"
echo "3. If issues persist, check: ./TROUBLESHOOTING.md"