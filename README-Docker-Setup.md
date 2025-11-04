# AutoPWN Docker Setup Guide

This guide will help you set up AutoPWN using Docker Compose for a complete development environment.

## Prerequisites

- Docker Desktop or Docker Engine with Docker Compose
- At least 4GB of RAM available
- Ports 3000, 3001, 5432, 6379, 1337, and 8081 must be available

## Quick Start

1. **Clone and prepare the project:**
   ```bash
   git clone <your-repo-url>
   cd autopwn
   cp .env.example .env.local
   ```

2. **Start the core services:**
   ```bash
   docker compose --profile dev up -d database redis api
   ```

3. **Wait for services to be healthy:**
   ```bash
   docker compose ps
   # Wait until all services show "healthy" status
   ```

4. **Initialize the database schema:**
   ```bash
   docker compose exec api npx drizzle-kit push
   ```

5. **Create admin user:**
   ```bash
   docker compose exec api npx tsx scripts/seed-superuser.ts
   ```

6. **Start additional services (optional):**
   ```bash
   # Adminer (Database UI)
   docker compose --profile dev up -d adminer

   # Redis Commander (Redis UI)
   docker compose --profile dev up -d redis-commander
   ```

7. **Run the web frontend locally:**
   ```bash
   cd apps/web
   pnpm install
   pnpm dev
   ```

## Services Overview

### Core Services (Always Required)

- **database**: PostgreSQL 16 on port 5432
- **redis**: Redis 7 on port 6379
- **api**: AutoPWN API server on port 3001

### Optional Development Tools

- **adminer**: Database administration UI on port 1337
- **redis-commander**: Redis administration UI on port 8081
- **web**: Next.js frontend on port 3000 (Docker version - see notes below)
- **worker**: Background job processor

## Environment Configuration

The project uses `.env.local` for local configuration. Key settings:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/autopwn_development

# API
PORT=3001
AUTH_SECRET=dev-secret-key-32-chars-long-minimum
JWT_SECRET=dev-jwt-secret-32-chars-long-minimum

# Frontend (for local development)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Access Points

Once started:

- **API Server**: http://localhost:3001
  - Health check: http://localhost:3001/health
  - API documentation: http://localhost:3001/api/info

- **Database**: localhost:5432
  - Username: postgres
  - Password: password
  - Database: autopwn_development

- **Redis**: localhost:6379

- **Adminer** (if enabled): http://localhost:1337

- **Redis Commander** (if enabled): http://localhost:8081

## Web Frontend Options

### Option 1: Local Development (Recommended)
```bash
cd apps/web
pnpm install
pnpm dev
```
Access at http://localhost:3000

### Option 2: Docker (Experimental)
```bash
docker compose --profile dev up -d web
```
*Note: The Docker web container may have issues. Local development is recommended.*

## Database Management

### View Database Schema
```bash
docker compose exec api npx drizzle-kit studio
```

### Reset Database
```bash
docker compose down --volumes
docker compose --profile dev up -d database redis api
docker compose exec api npx drizzle-kit push
```

### Create Test Data
```bash
docker compose exec api npx tsx scripts/seed-superuser.ts
```

## Troubleshooting

### Services Not Starting
1. Check if ports are available: `lsof -i :3000,3001,5432,6379`
2. Check Docker logs: `docker compose logs <service-name>`
3. Restart services: `docker compose restart <service-name>`

### Database Connection Issues
1. Ensure database is healthy: `docker compose ps database`
2. Check database logs: `docker compose logs database`
3. Test connection: `docker compose exec api psql $DATABASE_URL`

### Authentication Issues
1. Check if database schema is created: `docker compose exec api npx drizzle-kit push`
2. Verify auth secrets are set correctly in `.env.local`
3. Create admin user: `docker compose exec api npx tsx scripts/seed-superuser.ts`

### Redis Issues
1. Check Redis eviction policy (should be "noeviction"):
   ```bash
   docker compose exec redis redis-cli CONFIG GET maxmemory-policy
   ```
2. Fix if needed:
   ```bash
   docker compose exec redis redis-cli CONFIG SET maxmemory-policy noeviction
   ```

## Development Workflow

1. **Make changes to API code**
2. **Restart API service**: `docker compose restart api`
3. **Test changes**: Access API at http://localhost:3001
4. **Update database schema if needed**: `docker compose exec api npx drizzle-kit push`

## Production Deployment

For production, use the production profile:
```bash
docker compose --profile production up -d
```

This will:
- Use production environment variables
- Enable HTTPS
- Set up proper volumes for data persistence
- Configure production-ready Redis settings

## Security Notes

- Change default passwords in production
- Use proper SSL certificates
- Set secure AUTH_SECRET and JWT_SECRET values
- Configure proper CORS origins
- Enable Redis authentication in production

## Cleanup

To stop and remove all containers and data:
```bash
docker compose down --volumes --remove-orphans
```

To remove images (optional):
```bash
docker compose down --rmi all
```