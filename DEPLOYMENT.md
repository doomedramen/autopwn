# CrackHouse Deployment Guide

This guide covers deploying CrackHouse to production using Docker.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Building Images](#building-images)
- [Running in Production](#running-in-production)
- [Database Management](#database-management)
- [Monitoring & Logs](#monitoring--logs)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10+ and Docker Compose V2
- 4GB+ RAM (8GB+ recommended for large dictionary attacks)
- 20GB+ disk space (more for dictionaries and captures)
- Domain name (for production deployment)
- SSL certificate (recommended - use Let's Encrypt)

## Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/crackhouse.git
cd crackhouse
```

2. **Configure environment**
```bash
cp .env.production.example .env.production
nano .env.production  # Edit with your values
```

3. **Generate secrets**
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate Better Auth secret
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 24
```

4. **Build and start services**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

5. **Run database migrations**
```bash
docker exec -it crackhouse-api-prod pnpm db:migrate
```

6. **Create admin user** (optional)
```bash
docker exec -it crackhouse-api-prod pnpm db:seed-superuser
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | Strong random password |
| `REDIS_PASSWORD` | Redis password | Strong random password |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Generated with openssl |
| `BETTER_AUTH_SECRET` | Better Auth secret (min 32 chars) | Generated with openssl |
| `BETTER_AUTH_URL` | Your production URL | https://yourdomain.com |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_HOST` | SMTP server | smtp.gmail.com |
| `EMAIL_PORT` | SMTP port | 587 |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASSWORD` | SMTP password/app password | - |
| `MAX_CONCURRENT_JOBS` | Max parallel jobs | 5 |

See `.env.production.example` for all available options.

## Building Images

### Build all images
```bash
docker-compose -f docker-compose.prod.yml build
```

### Build specific service
```bash
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml build web
```

### Tag for DockerHub
```bash
docker tag crackhouse/api:latest yourname/crackhouse-api:1.0.0
docker tag crackhouse/web:latest yourname/crackhouse-web:1.0.0
```

### Push to DockerHub
```bash
docker push yourname/crackhouse-api:1.0.0
docker push yourname/crackhouse-web:1.0.0
```

## Running in Production

### Start all services
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Start specific service
```bash
docker-compose -f docker-compose.prod.yml up -d api
```

### Stop all services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Restart a service
```bash
docker-compose -f docker-compose.prod.yml restart api
```

### View running services
```bash
docker-compose -f docker-compose.prod.yml ps
```

## Database Management

### Run migrations
```bash
docker exec -it crackhouse-api-prod pnpm db:migrate
```

### Access database shell
```bash
docker exec -it crackhouse-db-prod psql -U postgres -d crackhouse
```

### Create database backup
```bash
docker exec crackhouse-db-prod pg_dump -U postgres crackhouse > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from backup
```bash
cat backup_file.sql | docker exec -i crackhouse-db-prod psql -U postgres -d crackhouse
```

## Monitoring & Logs

### View logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api
```

### Check service health
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Check API health endpoint
```bash
curl http://localhost:3001/health
```

### Monitor resource usage
```bash
docker stats
```

## Backup & Recovery

### Backup Strategy

1. **Database Backups** (automated with cron)
```bash
# Create daily backup script
#!/bin/bash
BACKUP_DIR="/backups/crackhouse"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec crackhouse-db-prod pg_dump -U postgres crackhouse > $BACKUP_DIR/db_$DATE.sql
# Keep last 7 days
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
```

2. **Volume Backups**
```bash
# Backup uploads
docker run --rm -v crackhouse_api_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads_backup.tar.gz /data

# Restore uploads
docker run --rm -v crackhouse_api_uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads_backup.tar.gz -C /
```

### Disaster Recovery

1. Stop all services
2. Restore database from backup
3. Restore volumes from backup
4. Start services
5. Verify functionality

## Reverse Proxy Setup (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for real-time updates
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check if ports are in use
netstat -tulpn | grep -E ':(3000|3001|5432|6379)'

# Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Database connection errors
```bash
# Check database is healthy
docker exec crackhouse-db-prod pg_isready -U postgres

# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
docker exec -it crackhouse-api-prod node -e "const postgres = require('postgres'); const sql = postgres(process.env.DATABASE_URL); sql\`SELECT 1\`.then(() => console.log('OK')).catch(console.error);"
```

### Out of memory errors
```bash
# Increase Docker memory limit
# Edit Docker Desktop settings or /etc/docker/daemon.json

# Reduce MAX_CONCURRENT_JOBS in .env.production
```

### Hashcat not working
```bash
# Verify hashcat is installed
docker exec crackhouse-api-prod hashcat --version

# Check hashcat can access GPU (if applicable)
docker exec crackhouse-api-prod hashcat -I
```

## Security Considerations

1. **Change all default passwords** in `.env.production`
2. **Use strong secrets** (min 32 characters)
3. **Enable firewall** - only expose ports 80/443
4. **Use HTTPS** in production (Let's Encrypt)
5. **Regular updates** - keep Docker images updated
6. **Backup strategy** - automated daily backups
7. **Monitor logs** - watch for suspicious activity

## Updating to New Version

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Stop services
docker-compose -f docker-compose.prod.yml down

# Start with new images
docker-compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker exec -it crackhouse-api-prod pnpm db:migrate
```

## Performance Tuning

### PostgreSQL
- Adjust `shared_buffers` for available RAM
- Enable query logging for slow queries
- Regular VACUUM and ANALYZE

### Redis
- Enable persistence (AOF + RDB)
- Set max memory policy

### Application
- Tune `MAX_CONCURRENT_JOBS` based on CPU cores
- Monitor queue depth
- Adjust worker concurrency

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/crackhouse/issues
- Documentation: https://github.com/yourusername/crackhouse/wiki

## License

See LICENSE file for details.
