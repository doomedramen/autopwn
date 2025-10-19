# AutoPWN Docker Setup

This document explains the Docker Compose configurations for AutoPWN.

## Architecture

- **Production Images**: Pre-built and pushed to DockerHub
- **Development**: Builds from source locally
- **All Production Compose Files**: Use `NODE_ENV=production`

## Docker Compose Files

### Development

**`docker-compose.dev.yml`** - Build from source for development
```bash
# Build and run from source
docker-compose -f docker-compose.dev.yml up -d

# With environment file
POSTGRES_PASSWORD=$(openssl rand -base64 32) \
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
docker-compose -f docker-compose.dev.yml up -d
```

Features:
- Builds from source using `docker/Dockerfile.cpu`
- Mounts source code for live development
- Uses development logging level (DEBUG)
- Creates separate development volumes

### Production

**`docker-compose.cpu.yml`** - Intel/AMD CPU production
**`docker-compose.amd.yml`** - AMD64 production
**`docker-compose.intel.yml`** - Intel optimized production
**`docker-compose.nvidia.yml`** - NVIDIA GPU production

All production files:
- Use pre-built images from DockerHub (`doomedramen/autopwn:latest-*`)
- Run in `NODE_ENV=production`
- Use production logging (INFO)
- No source code mounting

## Production Deployment

### 1. Environment Setup

Create an `.env` file (never commit to version control):
```bash
# Required
POSTGRES_PASSWORD=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com
LOG_LEVEL=INFO
```

### 2. Choose Your Hardware

**CPU (Intel/AMD):**
```bash
DOCKER_IMAGE=doomedramen/autopwn:latest-cpu docker-compose -f docker-compose.cpu.yml up -d
```

**AMD64 Optimized:**
```bash
DOCKER_IMAGE=doomedramen/autopwn:latest-amd docker-compose -f docker-compose.amd.yml up -d
```

**Intel Optimized:**
```bash
DOCKER_IMAGE=doomedramen/autopwn:latest-intel docker-compose -f docker-compose.intel.yml up -d
```

**NVIDIA GPU:**
```bash
DOCKER_IMAGE=doomedramen/autopwn:latest-nvidia docker-compose -f docker-compose.nvidia.yml up -d
```

### 3. Production Environment Variables

All production compose files support these variables:

**Required:**
- `POSTGRES_PASSWORD` - PostgreSQL database password
- `BETTER_AUTH_SECRET` - Authentication secret (min 32 chars)

**Optional:**
- `DOCKER_IMAGE` - Custom image override
- `NEXT_PUBLIC_APP_URL` - Application URL (default: http://localhost:3000)
- `BETTER_AUTH_URL` - Auth service URL (default: http://localhost:3000)
- `LOG_LEVEL` - Logging level (default: INFO)
- `MIN_PASSWORD_LENGTH` - Password minimum length (default: 8)
- `REQUIRE_PASSWORD_UPPERCASE` - Require uppercase in passwords (default: true)
- `REQUIRE_PASSWORD_LOWERCASE` - Require lowercase in passwords (default: true)
- `REQUIRE_PASSWORD_NUMBERS` - Require numbers in passwords (default: true)
- `REQUIRE_PASSWORD_SYMBOLS` - Require symbols in passwords (default: true)
- `ACCOUNT_LOCKOUT_ATTEMPTS` - Max login attempts (default: 5)
- `ACCOUNT_LOCKOUT_DURATION` - Lockout duration in minutes (default: 15)
- `SESSION_TIMEOUT` - Session timeout in hours (default: 24)

### 4. Security Notes

- Never commit secrets to version control
- Use strong, randomly generated passwords
- Enable TLS/SSL in production (reverse proxy recommended)
- Regularly update Docker images
- Monitor logs for security events

### 5. Volumes

Production creates persistent volumes:
- `postgres_data` - PostgreSQL database
- `uploads_data` - Uploaded PCAP and dictionary files
- `jobs_data` - Hashcat job outputs

### 6. Health Checks

Both PostgreSQL and application containers include health checks:
- PostgreSQL: `pg_isready` every 30 seconds
- Application: `/api/auth/status` every 30 seconds

### 7. Troubleshooting

**Database Connection Issues:**
```bash
# Check PostgreSQL logs
docker logs autopwn-postgres

# Check application logs
docker logs autopwn-app
```

**Migration Issues:**
```bash
# Manually run migrations
docker exec -it autopwn-app sh
npm run db:push
```

**Performance Issues:**
```bash
# Monitor resource usage
docker stats autopwn-app autopwn-postgres
```

## Development Workflow

1. **Local Development:** Use `docker-compose.dev.yml`
2. **Build Production Image:** Build and push to DockerHub
3. **Deploy:** Use appropriate production compose file

## Building Production Images

```bash
# CPU image
docker build -f docker/Dockerfile.cpu -t doomedramen/autopwn:latest-cpu .

# AMD64 image
docker build -f docker/Dockerfile.amd -t doomedramen/autopwn:latest-amd .

# Intel image
docker build -f docker/Dockerfile.intel -t doomedramen/autopwn:latest-intel .

# NVIDIA image
docker build -f docker/Dockerfile.nvidia -t doomedramen/autopwn:latest-nvidia .

# Push to registry
docker push doomedramen/autopwn:latest-cpu
docker push doomedramen/autopwn:latest-amd
docker push doomedramen/autopwn:latest-intel
docker push doomedramen/autopwn:latest-nvidia
```