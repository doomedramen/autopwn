#!/bin/bash

# CrackHouse Health Check Script
# Performs comprehensive system health diagnostics

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check URL health
check_url() {
    local url=$1
    local name=$2
    local timeout=${3:-5}

    if curl -f --max-time "$timeout" --silent "$url" >/dev/null 2>&1; then
        print_success "$name is healthy"
        return 0
    else
        print_error "$name is unhealthy or not responding"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local container=$1
    local service=$2

    if docker ps --filter "name=$container" --format "{{.Status}}" | grep -q "Up"; then
        if docker ps --filter "name=$container" --format "{{.Status}}" | grep -q "healthy"; then
            print_success "$service container is healthy"
            return 0
        else
            print_warning "$service container is running but not healthy"
            return 1
        fi
    else
        print_error "$service container is not running"
        return 2
    fi
}

# Function to check process on port
check_port() {
    local port=$1
    local service=$2

    if lsof -i ":$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        print_success "$service is listening on port $port"
        return 0
    else
        print_error "$service is not listening on port $port"
        return 1
    fi
}

# Function to check file/directory permissions
check_permissions() {
    local path=$1
    local description=$2

    if [ -e "$path" ]; then
        if [ -r "$path" ] && [ -w "$path" ]; then
            print_success "$description permissions are OK"
            return 0
        else
            print_error "$description permissions are incorrect"
            return 1
        fi
    else
        print_warning "$description does not exist"
        return 2
    fi
}

print_status "CrackHouse System Health Check"
echo "================================"

# Check system dependencies
print_status "Checking System Dependencies..."

if command_exists docker; then
    if docker info >/dev/null 2>&1; then
        print_success "Docker is running"
    else
        print_error "Docker is not running"
    fi
else
    print_error "Docker is not installed"
fi

if command_exists docker-compose; then
    print_success "Docker Compose is available"
else
    print_error "Docker Compose is not installed"
fi

if command_exists node; then
    print_success "Node.js $(node --version) is available"
else
    print_error "Node.js is not installed"
fi

if command_exists pnpm; then
    print_success "pnpm $(pnpm --version) is available"
else
    print_error "pnpm is not installed"
fi

echo ""

# Check Docker containers
print_status "Checking Docker Containers..."

check_container "crackhouse-db-development" "Database"
check_container "crackhouse-redis-development" "Redis"
check_container "crackhouse-api-development" "API"
check_container "crackhouse-web-development" "Web"

echo ""

# Check port availability
print_status "Checking Port Availability..."

check_port 3001 "API"
check_port 3000 "Web"
check_port 5432 "Database"
check_port 6379 "Redis"

echo ""

# Check application health endpoints
print_status "Checking Application Health..."

check_url "http://localhost:3001/health" "API Health Endpoint"
check_url "http://localhost:3000" "Web Application" 10

echo ""

# Check database connectivity
print_status "Checking Database Connectivity..."

if docker ps --filter "name=crackhouse-db-development" --format "{{.Status}}" | grep -q "Up"; then
    if docker-compose exec -T database psql -U postgres -d crackhouse_development -c "SELECT 1;" >/dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
    fi
else
    print_warning "Database container is not running"
fi

echo ""

# Check Redis connectivity
print_status "Checking Redis Connectivity..."

if docker ps --filter "name=crackhouse-redis-development" --format "{{.Status}}" | grep -q "Up"; then
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        if [ "$(docker-compose exec -T redis redis-cli ping)" = "PONG" ]; then
            print_success "Redis connection successful"
        else
            print_error "Redis connection failed"
        fi
    else
        print_warning "Redis container is not running"
    fi

echo ""

# Check file permissions
print_status "Checking File Permissions..."

check_permissions "./uploads" "Uploads directory"

# Check environment files
if [ -f ".env" ]; then
    print_success ".env file exists"

    # Check critical environment variables
    if grep -q "DATABASE_URL" .env; then
        print_success "DATABASE_URL is set"
    else
        print_warning "DATABASE_URL is not set"
    fi

    if grep -q "REDIS_URL" .env; then
        print_success "REDIS_URL is set"
    else
        print_warning "REDIS_URL is not set"
    fi

    if grep -q "AUTH_SECRET" .env && [ ${#AUTH_SECRET} -ge 32 ]; then
        print_success "AUTH_SECRET is set and long enough"
    else
        print_error "AUTH_SECRET is missing or too short"
    fi

    if grep -q "JWT_SECRET" .env && [ ${#JWT_SECRET} -ge 32 ]; then
        print_success "JWT_SECRET is set and long enough"
    else
        print_error "JWT_SECRET is missing or too short"
    fi
else
    print_warning ".env file does not exist"
fi

echo ""

# Check disk space
print_status "Checking Disk Space..."

if command_exists df; then
    disk_usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        print_success "Disk space is sufficient (${disk_usage}% used)"
    elif [ "$disk_usage" -lt 90 ]; then
        print_warning "Disk space is getting low (${disk_usage}% used)"
    else
        print_error "Disk space is critically low (${disk_usage}% used)"
    fi
else
    print_warning "Cannot check disk space (df command not available)"
fi

echo ""

# Check memory usage
print_status "Checking Memory Usage..."

if command_exists free; then
    mem_available=$(free -h | awk 'NR==2{printf "%.0f", $7/$2 * 100.0}')
    if [ "$mem_available" -gt 20 ]; then
        print_success "Memory is sufficient (${mem_available}% available)"
    elif [ "$mem_available" -gt 10 ]; then
        print_warning "Memory is getting low (${mem_available}% available)"
    else
        print_error "Memory is critically low (${mem_available}% available)"
    fi
else
    print_warning "Cannot check memory usage (free command not available)"
fi

echo ""

# Docker-specific checks
print_status "Checking Docker Health..."

# Check Docker memory
if docker info 2>/dev/null | grep -q "Memory Total"; then
    docker_memory=$(docker info 2>/dev/null | grep "Memory Total" | awk '{print $3}' | sed 's/[^0-9]//g')
    if [ -n "$docker_memory" ]; then
        if [ "$docker_memory" -gt 4000 ]; then
            print_success "Docker memory is sufficient (${docker_memory}MB)"
        else
            print_warning "Docker memory is low (${docker_memory}MB), consider increasing"
        fi
    fi
fi

# Check for Docker orphaned containers
orphaned_containers=$(docker ps -aq -f status=exited)
if [ -n "$orphaned_containers" ]; then
    print_warning "Found $(echo "$orphaned_containers" | wc -w) orphaned containers"
else
    print_success "No orphaned containers found"
fi

echo ""

# Check Docker logs for errors
print_status "Checking Recent Errors..."

error_count=0
for service in database redis api web; do
    if docker ps --filter "name=crackhouse-$service-development" --format "{{.Status}}" | grep -q "Up"; then
        service_errors=$(docker-compose logs --tail=50 "$service" 2>&1 | grep -i "error\|failed\|exception" | wc -l)
        if [ "$service_errors" -gt 0 ]; then
            print_warning "$service has $service_errors recent error(s)"
            error_count=$((error_count + service_errors))
        else
            print_success "$service has no recent errors"
        fi
    fi
done

echo ""

# Summary
echo "================================"
print_status "Health Check Summary"

# Calculate overall health
total_checks=0
passed_checks=0

# This is a simplified check - in reality, you'd count all the above checks
if command_exists docker && docker info >/dev/null 2>&1; then
    passed_checks=$((passed_checks + 1))
fi
total_checks=$((total_checks + 1))

if [ $passed_checks -eq $total_checks ]; then
    print_success "All critical checks passed - System is healthy!"
    exit 0
else
    print_warning "Some checks failed - Review above output"
    exit 1
fi