#!/bin/bash

# AutoPWN Local Build Script for Docker Production
# This script builds the applications locally before Docker deployment

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

# Check if pnpm is available
check_pnpm() {
    if ! command -v pnpm > /dev/null 2>&1; then
        print_error "pnpm is not installed. Please install pnpm first."
        exit 1
    fi
    print_success "pnpm is available"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    pnpm install
    print_success "Dependencies installed"
}

# Clean previous builds
clean_builds() {
    print_status "Cleaning previous builds..."

    # Clean API build
    if [ -d "apps/api/dist" ]; then
        rm -rf apps/api/dist
        print_status "Cleaned API dist folder"
    fi

    # Clean Web build
    if [ -d "apps/web/.next" ]; then
        rm -rf apps/web/.next
        print_status "Cleaned Web .next folder"
    fi

    # Clean packages builds
    if [ -d "packages/ui/dist" ]; then
        rm -rf packages/ui/dist
        print_status "Cleaned UI package dist folder"
    fi

    print_success "Previous builds cleaned"
}

# Build UI package first
build_ui_package() {
    print_status "Building UI package..."

    cd packages/ui
    pnpm run build || print_warning "UI package build failed or skipped (this may be expected)"
    cd ../..

    print_success "UI package build completed"
}

# Build API
build_api() {
    print_status "Building API..."

    cd apps/api
    pnpm run build
    cd ../..

    # Verify the build
    if [ ! -f "apps/api/dist/index.js" ]; then
        print_error "API build failed - index.js not found"
        exit 1
    fi

    print_success "API build completed"
}

# Build Web
build_web() {
    print_status "Building Web application..."

    cd apps/web
    pnpm run build
    cd ../..

    # Verify the build
    if [ ! -d "apps/web/.next" ]; then
        print_error "Web build failed - .next folder not found"
        exit 1
    fi

    print_success "Web build completed"
}

# Verify builds
verify_builds() {
    print_status "Verifying builds..."

    local missing_files=()

    # Check API build
    if [ ! -f "apps/api/dist/index.js" ]; then
        missing_files+=("apps/api/dist/index.js")
    fi

    # Check Web build
    if [ ! -d "apps/web/.next" ]; then
        missing_files+=("apps/web/.next directory")
    fi

    # Check package.json files
    if [ ! -f "apps/api/package.json" ]; then
        missing_files+=("apps/api/package.json")
    fi

    if [ ! -f "apps/web/package.json" ]; then
        missing_files+=("apps/web/package.json")
    fi

    if [ ${#missing_files[@]} -gt 0 ]; then
        print_error "Missing required files:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi

    print_success "All builds verified successfully"
}

# Show build summary
show_summary() {
    print_status "Build Summary:"
    echo "  API Build: $(ls -la apps/api/dist/ 2>/dev/null | wc -l) files"
    echo "  Web Build: $(ls -la apps/web/.next/ 2>/dev/null | wc -l) files"
    echo ""
    print_status "Build artifacts are ready for Docker deployment"
    echo ""
    print_status "Next steps:"
    echo "  1. Deploy: ./scripts/deploy-local-production.sh deploy"
    echo "  2. Or manually: docker-compose -f docker-compose.local.yml up --build"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean     Clean builds before building"
    echo "  --skip-ui   Skip UI package build (may be optional)"
    echo "  --help, -h  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Full build"
    echo "  $0 --clean      # Clean build"
    echo "  $0 --skip-ui    # Skip UI package"
}

# Main script logic
main() {
    local clean_build=false
    local skip_ui=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                clean_build=true
                shift
                ;;
            --skip-ui)
                skip_ui=true
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    print_status "Starting AutoPWN local build for Docker production..."

    # Run build steps
    check_pnpm
    install_dependencies

    if [ "$clean_build" = true ]; then
        clean_builds
    fi

    if [ "$skip_ui" = false ]; then
        build_ui_package
    else
        print_warning "Skipping UI package build"
    fi

    build_api
    build_web
    verify_builds
    show_summary

    print_success "Local build completed successfully!"
}

# Run main function with all arguments
main "$@"