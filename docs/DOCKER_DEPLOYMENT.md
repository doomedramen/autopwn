# Docker Deployment Guide

This guide covers deployment strategies for AutoPWN using Docker across different environments: development, testing, and production.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Overview](#environment-overview)
- [Development Environment](#development-environment)
- [Testing Environment](#testing-environment)
- [Production Environment](#production-environment)
- [Security Best Practices](#security-best-practices)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Development
```bash
# Start core services (PostgreSQL + Redis)
docker-compose -f docker-compose.dev.yml up -d

# Start with development tools (PgAdmin, Redis Commander, Mailhog)
docker-compose -f docker-compose.dev.yml --profile tools up -d

# Run API and Web locally with hot reload
pnpm --filter @autopwn/api dev
pnpm --filter @autopwn/web dev
```

### Testing
```bash
# Run integration tests with real DB/Redis
docker-compose -f docker-compose.test.yml up -d database redis
pnpm test:integration:real
docker-compose -f docker-compose.test.yml down

# Run E2E tests
docker-compose -f docker-compose.test.yml --profile e2e-test up -d
docker-compose -f docker-compose.test.yml exec e2e-test pnpm test:e2e
docker-compose -f docker-compose.test.yml down -v
```

### Production
```bash
# Create production environment file
cp .env.example .env.production

# Edit .env.production and set all required secrets
nano .env.production

# Start production stack
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check service health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

## Environment Overview

### Environment Comparison

| Feature | Development | Testing | Production |
|---------|------------|---------|------------|
| **Purpose** | Local development | Automated testing | Production deployment |
| **Data Persistence** | Persistent | Ephemeral (tmpfs) | Persistent with backups |
| **Hot Reload** | ✅ Yes | ❌ No | ❌ No |
| **Security** | Relaxed | Medium | Hardened |
| **Resource Limits** | Generous | Limited | Optimized |
| **Logging** | Verbose | Minimal | Structured |
| **Email** | Mailhog (testing) | Mocked | Real SMTP |
| **Database GUI** | PgAdmin (optional) | ❌ No | ❌ No |

### Service Architecture

```
┌─────────────────────────────────────────┐
│              Nginx (Prod)                │
│         Reverse Proxy + SSL              │
└──────────┬──────────────────────┬────────┘
           │                      │
    ┌──────▼──────┐        ┌─────▼──────┐
    │   Web (UI)   │        │  API Server │
    │  Next.js     │        │    Hono     │
    └──────┬───────┘        └─────┬───────┘
           │                      │
           └──────────┬───────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐  ┌────▼────┐  ┌───▼────┐
    │ Worker  │  │PostgreSQL│  │ Redis  │
    │ BullMQ  │  │ Database │  │ Cache  │
    └─────────┘  └──────────┘  └────────┘
```

## Development Environment

### Configuration: `docker-compose.dev.yml`

The development environment is optimized for local development with hot reload support.

### Starting Development Services

```bash
# Start only PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Include development tools (PgAdmin, Redis Commander, Mailhog)
docker-compose -f docker-compose.dev.yml --profile tools up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.dev.yml down -v
```

### Development Tools Access

When running with `--profile tools`:

- **PgAdmin**: http://localhost:8080
  - Email: `admin@autopwn.local`
  - Password: `admin123`
  - Add server: `postgres` (host), port `5432`

- **Redis Commander**: http://localhost:8081
  - Username: `admin`
  - Password: `admin`

- **Mailhog**: http://localhost:8025
  - SMTP: `localhost:1025`
  - All emails sent by the app appear here

### Environment Variables (.env.development)

Create `.env.development` for custom configuration:

```env
# Database
POSTGRES_DB=autopwn
POSTGRES_USER=autopwn
POSTGRES_PASSWORD=autopwn123
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379
REDIS_MAX_MEMORY=512mb

# Data paths
DATA_PATH=./data

# Development tools
PGADMIN_EMAIL=admin@autopwn.local
PGADMIN_PASSWORD=admin123
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025
```

### Running Application Locally

```bash
# 1. Start infrastructure
docker-compose -f docker-compose.dev.yml up -d

# 2. Run database migrations
pnpm --filter @autopwn/api db:migrate

# 3. Seed superuser (optional)
pnpm --filter @autopwn/api db:seed-superuser

# 4. Start API server (hot reload)
pnpm --filter @autopwn/api dev

# 5. Start Web frontend (hot reload)
pnpm --filter @autopwn/web dev
```

### Development Workflow

```bash
# Watch database changes with Drizzle Studio
pnpm --filter @autopwn/api db:studio

# Check Redis queue stats
pnpm --filter @autopwn/api queue:stats

# Check worker health
pnpm --filter @autopwn/api worker:health

# Run tests locally
pnpm test:unit
pnpm test:integration:real  # Uses Docker services
```

## Testing Environment

### Configuration: `docker-compose.test.yml`

The testing environment is optimized for fast, isolated test execution with tmpfs for maximum performance.

### Testing Profiles

The test environment uses Docker profiles for different test types:

- `manual-test`: Interactive test container
- `e2e-test`: End-to-end tests with full stack
- `db-setup`: Database migration and seeding

### Unit Tests (Fastest)

```bash
# No Docker needed for most unit tests
pnpm test:unit

# With coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Start test database and Redis
docker-compose -f docker-compose.test.yml up -d database redis

# Run integration tests
pnpm test:integration:real

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### E2E Tests

```bash
# Start full test stack (API + Web + E2E runner)
docker-compose -f docker-compose.test.yml --profile e2e-test up -d

# Wait for services to be healthy
docker-compose -f docker-compose.test.yml ps

# Setup test database
docker-compose -f docker-compose.test.yml --profile db-setup up test-db-seed

# Run E2E tests
docker-compose -f docker-compose.test.yml exec e2e-test pnpm test:e2e

# View test results
ls test-results/

# Cleanup
docker-compose -f docker-compose.test.yml --profile e2e-test down -v
```

### Manual Test Execution

```bash
# Start test runner container
docker-compose -f docker-compose.test.yml --profile manual-test up -d

# Execute tests inside container
docker-compose -f docker-compose.test.yml exec test-runner pnpm test:unit
docker-compose -f docker-compose.test.yml exec test-runner pnpm test:integration

# View logs
docker-compose -f docker-compose.test.yml logs -f test-runner

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Performance Optimizations

The test environment includes several optimizations:

1. **tmpfs for databases**: PostgreSQL and Redis use in-memory storage
2. **Cached volumes**: Source code uses `:cached` mount for better performance
3. **Resource limits**: Prevents resource exhaustion during parallel tests
4. **Fast health checks**: Reduced intervals for quicker startup
5. **Parallel execution**: `VITEST_POOL_SIZE=4` for concurrent tests

### Test Database Management

```bash
# Run migrations only
docker-compose -f docker-compose.test.yml --profile db-setup up test-db-migrate

# Run migrations + seed data
docker-compose -f docker-compose.test.yml --profile db-setup up test-db-seed

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

## Production Environment

### Configuration: `docker-compose.prod.yml`

The production environment is hardened for security, reliability, and performance.

### Pre-Deployment Checklist

- [ ] Create production environment file (`.env.production`)
- [ ] Set all required secrets (see below)
- [ ] Configure SSL certificates
- [ ] Set up backup strategy
- [ ] Configure monitoring and alerting
- [ ] Review resource limits
- [ ] Test disaster recovery procedures

### Required Environment Variables

Create `.env.production` with these **required** variables:

```env
# CRITICAL: These MUST be set for secure production deployment

# Database credentials
POSTGRES_USER=<strong-username>
POSTGRES_PASSWORD=<strong-password-32-chars+>
POSTGRES_DB=autopwn

# Redis password (CRITICAL for security)
# NOTE: If not set, Redis will run WITHOUT password protection
# This is a MAJOR security risk in production!
REDIS_PASSWORD=<strong-password-32-chars+>

# Authentication secrets (generate with: openssl rand -base64 32)
AUTH_SECRET=<random-32-char-secret>
JWT_SECRET=<random-32-char-secret>

# Application URLs
FRONTEND_URL=https://autopwn.yourdomain.com
API_URL=https://api.autopwn.yourdomain.com
AUTH_URL=https://api.autopwn.yourdomain.com/auth

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-sendgrid-api-key>
SMTP_FROM=noreply@yourdomain.com

# Optional: Resource limits
MAX_CONCURRENT_JOBS=3
RATE_LIMIT_MAX=100
CORS_ORIGIN=https://autopwn.yourdomain.com

# Optional: Version tag
VERSION=1.0.0

# Optional: Data path
DATA_PATH=./data
```

### Generating Secrets

```bash
# Generate secure random secrets
openssl rand -base64 32  # AUTH_SECRET
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # POSTGRES_PASSWORD
openssl rand -base64 32  # REDIS_PASSWORD
```

### Production Deployment

```bash
# 1. Verify environment file
cat .env.production

# 2. Create required directories
mkdir -p ./data/{postgres,redis,uploads}
mkdir -p ./backups/postgres
mkdir -p ./nginx/{conf.d,ssl}

# 3. Build production images
docker-compose -f docker-compose.prod.yml --env-file .env.production build

# 4. Start services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 5. Check service health
docker-compose -f docker-compose.prod.yml ps

# 6. View startup logs
docker-compose -f docker-compose.prod.yml logs -f

# 7. Run database migrations
docker-compose -f docker-compose.prod.yml exec api pnpm db:migrate

# 8. Create superuser
docker-compose -f docker-compose.prod.yml exec api pnpm db:seed-superuser
```

### With Nginx Reverse Proxy

```bash
# Start with Nginx profile
docker-compose -f docker-compose.prod.yml --env-file .env.production --profile with-proxy up -d

# View Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### SSL Certificate Setup

1. Place SSL certificates in `./nginx/ssl/`:
   ```
   nginx/ssl/
   ├── fullchain.pem
   └── privkey.pem
   ```

2. Configure Nginx (example in `./nginx/conf.d/autopwn.conf`):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name autopwn.yourdomain.com;

       ssl_certificate /etc/nginx/ssl/fullchain.pem;
       ssl_certificate_key /etc/nginx/ssl/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       location / {
           proxy_pass http://web:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /api {
           proxy_pass http://api:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Production Monitoring

```bash
# View all service statuses
docker-compose -f docker-compose.prod.yml ps

# Check resource usage
docker stats

# View logs (last 100 lines)
docker-compose -f docker-compose.prod.yml logs --tail=100

# Follow specific service logs
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f worker

# Check health endpoints
curl http://localhost:3001/health
```

### Backup and Restore

#### Database Backup

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec database pg_dump -U autopwn autopwn > ./backups/postgres/backup-$(date +%Y%m%d-%H%M%S).sql

# Automated daily backups (add to crontab)
0 2 * * * cd /path/to/autopwn && docker-compose -f docker-compose.prod.yml exec -T database pg_dump -U autopwn autopwn > ./backups/postgres/backup-$(date +\%Y\%m\%d).sql
```

#### Database Restore

```bash
# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T database psql -U autopwn autopwn < ./backups/postgres/backup-20250124.sql
```

#### Volume Backup

```bash
# Backup persistent volumes
docker run --rm -v autopwn_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres_data-$(date +%Y%m%d).tar.gz -C /data .

docker run --rm -v autopwn_uploads_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/uploads_data-$(date +%Y%m%d).tar.gz -C /data .
```

### Scaling Services

```bash
# Scale worker instances
docker-compose -f docker-compose.prod.yml up -d --scale worker=3

# Scale API instances (requires load balancer)
docker-compose -f docker-compose.prod.yml up -d --scale api=2
```

### Rolling Updates

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild images
docker-compose -f docker-compose.prod.yml --env-file .env.production build

# 3. Restart services one by one
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api
docker-compose -f docker-compose.prod.yml up -d --no-deps --build worker
docker-compose -f docker-compose.prod.yml up -d --no-deps --build web

# 4. Verify health
docker-compose -f docker-compose.prod.yml ps
```

## Security Best Practices

### Container Security

1. **Read-only filesystems**: Most containers run with `read_only: true`
2. **No new privileges**: `no-new-privileges:true` prevents privilege escalation
3. **Resource limits**: CPU and memory limits prevent DoS
4. **Non-root users**: Containers run as non-root where possible
5. **Network isolation**: Backend network is internal-only

### Network Security

```yaml
# Production uses isolated networks
networks:
  autopwn-backend:
    driver: bridge
    internal: true  # No external access
  autopwn-frontend:
    driver: bridge  # Public access via Nginx only
```

### Secret Management

**Never commit secrets to version control!**

```bash
# Use environment files (add to .gitignore)
.env.production
.env.local
.env.*.local

# Or use Docker secrets (recommended for Swarm)
echo "my-secret-password" | docker secret create postgres_password -

# Reference in compose file:
services:
  database:
    secrets:
      - postgres_password
```

### Redis Password Security

**CRITICAL:** Redis password is handled with conditional logic to allow validation without requiring the password to be set during development/testing. However, this creates a security risk if not properly configured in production.

#### Production Behavior:

```yaml
# If REDIS_PASSWORD is set:
✅ Redis starts with password protection (secure)
✅ Healthcheck uses password authentication
✅ Connections require authentication

# If REDIS_PASSWORD is NOT set:
❌ Redis starts WITHOUT password protection (INSECURE!)
⚠️  Large warning message displayed in logs
❌ Anyone can connect without authentication
```

#### Security Recommendations:

1. **Always set REDIS_PASSWORD in production:**
   ```bash
   # Generate strong password
   REDIS_PASSWORD=$(openssl rand -base64 32)
   echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env.production
   ```

2. **Verify Redis is password protected:**
   ```bash
   # Should fail without password
   docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
   # Error: NOAUTH Authentication required.

   # Should succeed with password
   docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" ping
   # PONG
   ```

3. **Check startup logs for warnings:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs redis | grep -i warning
   # Should NOT see "Redis running WITHOUT password protection"
   ```

4. **Update application configuration:**
   Ensure your application connects to Redis with the password:
   ```env
   REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
   ```

### Port Binding

```yaml
# GOOD: Bind to localhost only
ports:
  - "127.0.0.1:5432:5432"

# BAD: Exposed to all interfaces
ports:
  - "5432:5432"
```

## Performance Optimization

### Database Tuning

Production PostgreSQL is tuned for performance:

```env
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_WORK_MEM=16MB
POSTGRES_MAINTENANCE_WORK_MEM=128MB
```

### Redis Configuration

```bash
# Memory limit and eviction policy
--maxmemory 512mb
--maxmemory-policy allkeys-lru

# Persistence (production)
--appendonly yes
--appendfsync everysec

# No persistence (testing)
--save ""
--appendonly no
```

### Volume Performance

```yaml
# Use cached mounts for source code in development
volumes:
  - ./apps/api:/app/apps/api:cached

# Use tmpfs for ephemeral data (testing)
tmpfs:
  - /var/lib/postgresql/data:rw,size=512m
```

### Resource Allocation

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View error logs
docker-compose -f docker-compose.prod.yml logs

# Check specific service
docker-compose -f docker-compose.prod.yml logs database
docker-compose -f docker-compose.prod.yml logs api
```

### Database Connection Issues

```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec database pg_isready -U autopwn

# Check database logs
docker-compose -f docker-compose.prod.yml logs database

# Connect to database manually
docker-compose -f docker-compose.prod.yml exec database psql -U autopwn -d autopwn

# Verify DATABASE_URL environment variable
docker-compose -f docker-compose.prod.yml exec api printenv | grep DATABASE_URL
```

### Redis Connection Issues

```bash
# Test Redis connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping

# Check Redis logs
docker-compose -f docker-compose.prod.yml logs redis

# Connect to Redis manually
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# With password (production)
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a <password>
```

### Health Check Failures

```bash
# Check health status
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint manually
docker-compose -f docker-compose.prod.yml exec api curl -f http://localhost:3001/health

# View health check logs
docker inspect --format='{{json .State.Health}}' autopwn-api-prod | jq
```

### Out of Memory

```bash
# Check container memory usage
docker stats

# Increase memory limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 4G  # Increase from 2G
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up unused images
docker system prune -a

# Remove old volumes
docker volume prune

# Check volume sizes
docker system df -v
```

### Network Issues

```bash
# Check network configuration
docker network ls
docker network inspect autopwn-backend

# Test inter-container connectivity
docker-compose -f docker-compose.prod.yml exec api ping database
docker-compose -f docker-compose.prod.yml exec api ping redis

# Check port bindings
docker-compose -f docker-compose.prod.yml port api 3001
```

### Performance Issues

```bash
# Check resource usage
docker stats

# View slow query logs (PostgreSQL)
docker-compose -f docker-compose.prod.yml exec database psql -U autopwn -d autopwn -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis memory usage
docker-compose -f docker-compose.prod.yml exec redis redis-cli info memory

# Profile API performance
docker-compose -f docker-compose.prod.yml exec api pnpm dlx clinic doctor -- node dist/index.js
```

### Logs Not Appearing

```bash
# Check logging configuration
docker-compose -f docker-compose.prod.yml config

# View logs with timestamps
docker-compose -f docker-compose.prod.yml logs -f --timestamps

# Check log files (if using file logging)
ls -lh /var/lib/docker/containers/*/
```

## Common Commands Reference

### Development

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml --profile tools up -d

# Stop services
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml down -v  # Remove volumes

# Restart single service
docker-compose -f docker-compose.dev.yml restart postgres

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Testing

```bash
# Integration tests
docker-compose -f docker-compose.test.yml up -d database redis
pnpm test:integration:real
docker-compose -f docker-compose.test.yml down -v

# E2E tests
docker-compose -f docker-compose.test.yml --profile e2e-test up -d
docker-compose -f docker-compose.test.yml exec e2e-test pnpm test:e2e
docker-compose -f docker-compose.test.yml down -v

# Database setup
docker-compose -f docker-compose.test.yml --profile db-setup up test-db-seed
```

### Production

```bash
# Deploy
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Update
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps api

# Backup
docker-compose -f docker-compose.prod.yml exec database pg_dump -U autopwn autopwn > backup.sql

# Scale
docker-compose -f docker-compose.prod.yml up -d --scale worker=3

# Logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
