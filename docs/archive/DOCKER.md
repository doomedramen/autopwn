# AutoPWN Docker Configuration

This directory contains comprehensive Docker configurations for the AutoPWN project, supporting development, testing, and CI/CD environments.

## Quick Start

### Development Environment

```bash
# Start the complete development environment
./scripts/docker-dev.sh start

# View logs
./scripts/docker-dev.sh logs

# Stop the environment
./scripts/docker-dev.sh stop
```

### Testing Environment

```bash
# Start test environment and run tests
./scripts/docker-test.sh start
./scripts/docker-test.sh setup
./scripts/docker-test.sh all

# Or run specific test types
./scripts/docker-test.sh unit
./scripts/docker-test.sh integration
```

## Architecture Overview

### Services

The AutoPWN Docker environment consists of the following services:

#### Core Services
- **database**: PostgreSQL 16 database
- **redis**: Redis 7 for caching and job queues
- **api**: AutoPWN API server (Node.js + Hono)
- **web**: Next.js web frontend
- **worker**: Background job processor

#### Development Tools
- **adminer**: Database administration UI (http://localhost:8080)
- **redis-commander**: Redis administration UI (http://localhost:8081)

#### Testing Services
- **test-runner**: Container for running tests
- **e2e-test**: Container for end-to-end testing

## Docker Compose Files

### `docker-compose.yml`
Main development configuration with all services and development tools.

**Profiles:**
- `dev`: Development services (api, web, database, redis, worker)
- `tools`: Administration tools (adminer, redis-commander)

**Usage:**
```bash
# Start development environment
NODE_ENV=development docker-compose --profile dev up -d

# Start with tools
NODE_ENV=development docker-compose --profile dev --profile tools up -d
```

### `docker-compose.test.yml`
Isolated testing environment with separate ports and databases.

**Profiles:**
- `integration-test`: Integration testing setup
- `e2e-test`: End-to-end testing with full application stack
- `db-setup`: Database migration and seeding

**Usage:**
```bash
# Start test environment
NODE_ENV=test docker-compose -f docker-compose.test.yml --profile integration-test up -d
```

### `docker-compose.ci.yml`
Optimized for continuous integration with tmpfs for performance.

**Profiles:**
- `ci-setup`: Database setup for CI
- `unit-tests`: Unit test execution
- `integration-tests`: Integration test execution
- `performance-tests`: Performance test execution
- `e2e-tests`: End-to-end test execution

## Dockerfiles

### `Dockerfile`
Multi-stage build for API and worker services.

**Stages:**
- `base`: Base dependencies
- `development`: Development with hot-reload
- `test`: Testing with additional tools
- `ci`: CI-optimized build
- `production`: Production-ready build

### `Dockerfile.web`
Multi-stage build for Next.js frontend.

**Stages:**
- `base`: Base dependencies
- `development`: Development with hot-reload
- `test`: Testing with Playwright
- `ci`: CI-optimized build
- `production`: Production-ready build

### `Dockerfile.test`
Optimized for running tests in containers.

### `Dockerfile.e2e`
Optimized for Playwright end-to-end testing.

### `Dockerfile.ci`
Optimized for CI/CD pipelines.

## Configuration

### Environment Variables

#### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password

#### Redis Configuration
- `REDIS_URL`: Redis connection string
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port

#### Application Configuration
- `NODE_ENV`: Environment (development/test/production)
- `PORT`: Application port
- `AUTH_SECRET`: Authentication secret
- `JWT_SECRET`: JWT secret
- `FRONTEND_URL`: Frontend application URL
- `CORS_ORIGIN`: CORS allowed origins

### Redis Configuration

#### Development (`config/redis.conf`)
- Persistent storage enabled
- Memory limit: 256MB
- Snapshotting enabled
- Slow query logging

#### Test (`config/redis-test.conf`)
- In-memory only (no persistence)
- Memory limit: 128MB
- Optimized for test performance
- Minimal logging

## Management Scripts

### Development Script (`scripts/docker-dev.sh`)

Convenient commands for managing the development environment:

```bash
./scripts/docker-dev.sh start          # Start all services
./scripts/docker-dev.sh stop           # Stop all services
./scripts/docker-dev.sh restart        # Restart all services
./scripts/docker-dev.sh logs [service] # Show logs
./scripts/docker-dev.sh shell [service] # Open shell
./scripts/docker-dev.sh db             # Open database shell
./scripts/docker-dev.sh redis          # Open redis shell
./scripts/docker-dev.sh status         # Show status
./scripts/docker-dev.sh clean          # Clean up (destructive)
./scripts/docker-dev.sh rebuild        # Rebuild images
./scripts/docker-dev.sh tools          # Start admin tools
```

### Test Script (`scripts/docker-test.sh`)

Convenient commands for managing the test environment:

```bash
./scripts/docker-test.sh start          # Start test environment
./scripts/docker-test.sh setup          # Setup test database
./scripts/docker-test.sh unit           # Run unit tests
./scripts/docker-test.sh integration   # Run integration tests
./scripts/docker-test.sh performance   # Run performance tests
./scripts/docker-test.sh all            # Run all tests
./scripts/docker-test.sh clean          # Clean up test environment
```

## Port Mappings

### Development Environment
- **API**: 3001 (http://localhost:3001)
- **Web**: 3000 (http://localhost:3000)
- **Database**: 5432 (localhost:5432)
- **Redis**: 6379 (localhost:6379)
- **Adminer**: 8080 (http://localhost:8080)
- **Redis Commander**: 8081 (http://localhost:8081)

### Test Environment
- **Test API**: 3002 (http://localhost:3002)
- **Test Database**: 5433 (localhost:5433)
- **Test Redis**: 6380 (localhost:6380)

## Data Persistence

### Volumes

#### Development
- `postgres_data_development`: PostgreSQL data
- `redis_data_development`: Redis data
- `uploads_data_development`: File uploads

#### Test
- `postgres_test_data`: Test PostgreSQL data
- `redis_test_data`: Test Redis data
- `test_uploads`: Test file uploads
- `test_results`: Test result artifacts

## Health Checks

All services include comprehensive health checks:

### Database
```bash
pg_isready -U postgres
```

### Redis
```bash
redis-cli ping
```

### API
```bash
curl -f http://localhost:3001/health
```

### Web
```bash
curl -f http://localhost:3000
```

## Security Considerations

1. **Non-root Users**: All containers run as non-root users
2. **Minimal Images**: Based on Alpine Linux for smaller attack surface
3. **Resource Limits**: Memory and CPU limits configured
4. **Network Isolation**: Services in isolated Docker network
5. **Secret Management**: Environment variables for sensitive data

## Performance Optimizations

1. **Multi-stage Builds**: Reduce final image size
2. **Layer Caching**: Optimized COPY order for better caching
3. **tmpfs in Tests**: Use memory filesystem for test performance
4. **Connection Pooling**: Database connection pooling configured
5. **Health Checks**: Efficient health check implementations

## Troubleshooting

### Common Issues

#### Port Conflicts
If you encounter port conflicts, the test environment uses different ports:
- Database: 5433 instead of 5432
- Redis: 6380 instead of 6379
- API: 3002 instead of 3001

#### Permission Issues
All containers run as non-root users. If you encounter permission issues with volumes:
```bash
sudo chown -R 1001:1001 ./uploads
```

#### Memory Issues
For testing, increase Docker memory allocation to at least 4GB.

#### Build Issues
If builds fail, try rebuilding without cache:
```bash
./scripts/docker-dev.sh rebuild
```

### Debugging

#### Container Logs
```bash
# View all logs
./scripts/docker-dev.sh logs

# View specific service logs
./scripts/docker-dev.sh logs api
./scripts/docker-dev.sh logs database
```

#### Container Shell Access
```bash
# Access container shell
./scripts/docker-dev.sh shell api
./scripts/docker-dev.sh shell database
```

#### Database Access
```bash
# Access database shell
./scripts/docker-dev.sh db

# Access Redis shell
./scripts/docker-dev.sh redis
```

## CI/CD Integration

The Docker configuration is designed to work seamlessly with CI/CD pipelines:

### GitHub Actions
```yaml
- name: Start test environment
  run: |
    docker-compose -f docker-compose.ci.yml --profile ci-setup up -d
    docker-compose -f docker-compose.ci.yml run --rm ci-unit-tests
```

### Environment-Specific Testing
```bash
# Unit tests only
docker-compose -f docker-compose.ci.yml --profile unit-tests up

# Integration tests only
docker-compose -f docker-compose.ci.yml --profile integration-tests up

# E2E tests only
docker-compose -f docker-compose.ci.yml --profile e2e-tests up
```

## Development Workflow

### First-time Setup
```bash
# Clone repository
git clone <repository-url>
cd autopwn

# Start development environment
./scripts/docker-dev.sh start

# Setup database
./scripts/docker-dev.sh shell api
# Inside container: pnpm db:migrate && pnpm db:seed-superuser
```

### Daily Development
```bash
# Start environment
./scripts/docker-dev.sh start

# View logs while developing
./scripts/docker-dev.sh logs -f

# Access database if needed
./scripts/docker-dev.sh db
```

### Testing Before Commit
```bash
# Run tests in isolated environment
./scripts/docker-test.sh start
./scripts/docker-test.sh setup
./scripts/docker-test.sh all

# Clean up test environment
./scripts/docker-test.sh clean
```

## Production Deployment

For production deployment, use the production targets:

```bash
# Build production images
docker-compose build --target production

# Or use CI pipeline with docker-compose.ci.yml
docker-compose -f docker-compose.ci.yml up
```