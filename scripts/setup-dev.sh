#!/bin/bash

# CrackHouse Development Setup Script
# This script sets up the development environment with Docker Compose

set -e

echo "🚀 CrackHouse Development Setup"
echo "=============================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check if .env.local exists, if not copy from example
if [ ! -f .env.local ]; then
    echo "📄 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "✅ Created .env.local"
fi

# Start core services
echo "🐳 Starting Docker services (database, redis, api)..."
docker compose --profile dev up -d database redis api

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
if ! docker compose ps | grep -q "healthy"; then
    echo "❌ Services are not healthy. Please check docker logs."
    docker compose logs
    exit 1
fi

echo "✅ All services are healthy"

# Initialize database schema
echo "🗄️ Initializing database schema..."
cd apps/api
DATABASE_URL="postgresql://postgres:password@localhost:5432/crackhouse_development" npx drizzle-kit push --force

# Create superuser
echo "👤 Creating superuser..."
DATABASE_URL="postgresql://postgres:password@localhost:5432/crackhouse_development" npx tsx src/db/seed-superuser.ts

cd ../..

echo ""
echo "🎉 Setup completed successfully!"
echo "=============================="
echo "📧 Admin Email: admin@crackhouse.local"
echo "🔑 Admin Password: admin123 (development environment)"
echo "🌐 Web Server: http://localhost:3000 (run locally with 'cd apps/web && pnpm dev')"
echo "🔧 API Server: http://localhost:3001"
echo ""
echo "Next steps:"
echo "1. Start web server: cd apps/web && pnpm dev"
echo "2. Visit http://localhost:3000 and sign in with the admin credentials"
echo "3. Run e2e tests: DATABASE_URL=\"postgresql://postgres:password@localhost:5432/crackhouse_test\" E2E_ADMIN_PASSWORD=admin123 pnpm test:e2e"