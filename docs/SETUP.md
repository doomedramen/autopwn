# Setup Guide

Complete installation and configuration guide for autopwn.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Initial Setup](#initial-setup)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum:**
- 2 CPU cores
- 4GB RAM
- 20GB disk space
- Docker 24.0+
- Docker Compose 2.0+

**Recommended:**
- 4+ CPU cores (more cores = better hashcat performance)
- 8GB+ RAM
- 100GB+ disk space (for captures and dictionaries)
- SSD storage

**Network:**
- Open ports: 3000 (web interface), 4000 (API, optional if using Docker network)

### Software

Install Docker and Docker Compose:

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

**macOS:**
```bash
# Install Docker Desktop
brew install --cask docker
```

**Windows:**
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/autopwn.git
cd autopwn
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Generate Secrets

Generate secure random secrets for your installation:

```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate DATABASE_PASSWORD
openssl rand -base64 24
```

### 4. Edit Environment Variables

Edit `.env` with your preferred editor:

```bash
nano .env
```

**Minimal required changes:**
```bash
# Replace these with your generated secrets
SESSION_SECRET=<your-generated-session-secret>
DATABASE_PASSWORD=<your-generated-db-password>

# Update the database URL with your password
DATABASE_URL=postgresql://autopwn:<your-generated-db-password>@db:5432/autopwn
```

### 5. Start the Application

```bash
docker compose up -d
```

### 6. View Logs and Get Initial Credentials

```bash
docker compose logs backend
```

Look for output like:
```
🔐 Initial Superuser Created
Email: admin@autopwn.local
Password: <randomly-generated-password>

⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN
```

### 7. Access the Application

Open your browser to: `http://localhost:3000`

Log in with the credentials from step 6.

**⚠️ Important: Change the default password immediately!**

## Environment Variables

### Complete .env Reference

```bash
# ============================================
# Application
# ============================================
NODE_ENV=production
APP_NAME=autopwn
APP_URL=http://localhost:3000

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:4000

# Backend (Fastify)
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000

# ============================================
# Database (PostgreSQL)
# ============================================
DATABASE_URL=postgresql://autopwn:your_secure_password@db:5432/autopwn
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_NAME=autopwn
DATABASE_USER=autopwn
DATABASE_PASSWORD=your_secure_password

# Connection pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ============================================
# Redis (Job Queue)
# ============================================
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# Authentication (Better Auth)
# ============================================
SESSION_SECRET=your_very_long_random_secret_here_at_least_32_chars
SESSION_MAX_AGE=604800  # 7 days in seconds
BCRYPT_ROUNDS=12

# Initial superuser (generated if doesn't exist)
INITIAL_SUPERUSER_EMAIL=admin@autopwn.local
INITIAL_SUPERUSER_PASSWORD=  # Leave empty to auto-generate

# ============================================
# File Storage
# ============================================
UPLOAD_DIR=/data/uploads
PROCESSED_DIR=/data/processed
GENERATED_DIR=/data/generated
HASHCAT_DIR=/data/hashcat
LOG_DIR=/data/logs

# File size limits (in bytes)
MAX_PCAP_SIZE=524288000        # 500MB
MAX_DICTIONARY_SIZE=10737418240  # 10GB
MAX_GENERATED_DICT_SIZE=21474836480  # 20GB

# ============================================
# Hashcat Configuration
# ============================================
# Maximum concurrent hashcat jobs
HASHCAT_MAX_CONCURRENT_JOBS=2

# Default workload profile (1-4, higher = more intensive)
HASHCAT_DEFAULT_WORKLOAD=3

# Job timeout (in seconds, 0 = no timeout)
HASHCAT_JOB_TIMEOUT=86400  # 24 hours

# Hashcat binary path (in container)
HASHCAT_BINARY=/usr/bin/hashcat

# Status update interval (seconds)
HASHCAT_STATUS_INTERVAL=10

# ============================================
# hcxtools Configuration
# ============================================
HCXPCAPNGTOOL_BINARY=/usr/bin/hcxpcapngtool

# ============================================
# Dictionary Generation
# ============================================
CRUNCH_BINARY=/usr/bin/crunch

# Maximum keywords for generation
MAX_GENERATION_KEYWORDS=50

# Maximum dictionary lines (0 = unlimited, use with caution)
MAX_DICTIONARY_LINES=0

# ============================================
# Job Queue (BullMQ)
# ============================================
# Retry settings
JOB_RETRY_ATTEMPTS=3
JOB_RETRY_DELAY=5000  # milliseconds

# Job removal settings (keep failed jobs for debugging)
REMOVE_ON_COMPLETE=false
REMOVE_ON_FAIL=false

# Queue concurrency
CONVERSION_QUEUE_CONCURRENCY=3
GENERATION_QUEUE_CONCURRENCY=2

# ============================================
# Logging
# ============================================
LOG_LEVEL=info  # error, warn, info, debug, trace
PRETTY_LOGS=true  # false for production JSON logs

# ============================================
# Security
# ============================================
# CORS origins (comma-separated)
CORS_ORIGINS=http://localhost:3000

# ============================================
# Features (Future)
# ============================================
# S3-compatible storage
S3_ENABLED=false
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=us-east-1

# GPU support
GPU_ENABLED=false
GPU_DEVICES=0  # Comma-separated GPU IDs

# Notifications
NOTIFICATIONS_ENABLED=false
WEBHOOK_URL=

# ============================================
# Development
# ============================================
# Set to true for hot-reloading
DEV_MODE=false

# Bull Board (queue monitoring dashboard)
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues
```

## Initial Setup

### First Login

1. Access `http://localhost:3000/login`
2. Enter the credentials from the startup logs
3. You'll be prompted to change your password
4. Set a strong password (minimum 12 characters recommended)

### Create Additional Users

As a superuser, you can create admin and regular users:

1. Navigate to `/admin/users`
2. Click "Add User"
3. Fill in the form:
   - **Email**: User's email address
   - **Password**: Initial password (user should change on first login)
   - **Role**: User, Admin, or Superuser
4. Click "Create User"

**Role Capabilities:**
- **User**: Can upload captures, create dictionaries, run jobs
- **Admin**: User permissions + can manage other users (except superusers)
- **Superuser**: Full system access + system configuration

### System Configuration

Navigate to `/admin/config` (superuser only) to configure:

1. **Job Concurrency**: Maximum simultaneous hashcat jobs
2. **File Size Limits**: PCAP and dictionary upload limits
3. **Dictionary Generation Limits**: Maximum keywords and output size
4. **Hashcat Settings**: Default workload profile, timeout

## Configuration

### Volume Mounting

The default `docker-compose.yml` creates a named volume. To use a specific directory:

```yaml
volumes:
  - /path/on/host:/data
```

**Example: Use external drive for storage**
```yaml
services:
  backend:
    volumes:
      - /mnt/storage/autopwn:/data
```

### Resource Limits

Limit CPU and memory usage in `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

### Reverse Proxy Setup

#### nginx

```nginx
server {
    listen 80;
    server_name autopwn.yourdomain.com;

    client_max_body_size 500M;  # Match your PCAP size limit

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Add SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d autopwn.yourdomain.com
```

#### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.autopwn.rule=Host(`autopwn.yourdomain.com`)"
  - "traefik.http.routers.autopwn.entrypoints=websecure"
  - "traefik.http.routers.autopwn.tls.certresolver=letsencrypt"
  - "traefik.http.services.autopwn.loadbalancer.server.port=3000"
```

### Database Backups

#### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/autopwn"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="autopwn-db-1"

mkdir -p $BACKUP_DIR

docker exec $CONTAINER pg_dump -U autopwn autopwn | gzip > "$BACKUP_DIR/autopwn_$DATE.sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "autopwn_*.sql.gz" -mtime +30 -delete

echo "Backup completed: autopwn_$DATE.sql.gz"
```

Make it executable and add to cron:
```bash
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /path/to/backup.sh
```

#### Restore from Backup

```bash
gunzip -c /backups/autopwn/autopwn_20250119_020000.sql.gz | \
  docker exec -i autopwn-db-1 psql -U autopwn autopwn
```

### Monitoring

#### Queue Dashboard (Bull Board)

Access the job queue monitoring dashboard:

`http://localhost:3000/admin/queues`

**Features:**
- View active, waiting, completed, and failed jobs
- Retry failed jobs
- View job details and logs
- Monitor queue health

**Access:** Superuser and Admin only

#### Docker Health Checks

Monitor container health:

```bash
docker compose ps
```

All services should show "healthy" status.

View logs:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f worker
```

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose logs backend
docker compose logs db
docker compose logs redis
```

**Common issues:**
- Port already in use: Change ports in `docker-compose.yml`
- Permission denied on volume: `sudo chown -R 1000:1000 /data`
- Database connection failed: Check DATABASE_URL in `.env`

### Can't Log In

**Reset superuser password:**
```bash
docker compose exec backend npm run reset-superuser
```

This will output new credentials.

### Jobs Not Running

**Check queue status:**
1. Visit `http://localhost:3000/admin/queues`
2. Check for errors in failed jobs
3. View worker logs: `docker compose logs -f worker`

**Common issues:**
- Redis not running: `docker compose ps redis`
- Worker crashed: `docker compose restart worker`
- Job timeout too low: Increase `HASHCAT_JOB_TIMEOUT` in `.env`

### File Upload Fails

**Check:**
1. File size limit: Ensure file is under `MAX_PCAP_SIZE`
2. Disk space: `df -h /data`
3. Upload logs: `docker compose logs -f backend`

**Increase upload limit:**
```bash
# In .env
MAX_PCAP_SIZE=1073741824  # 1GB
```

Restart backend:
```bash
docker compose restart backend
```

### Hashcat Not Finding Networks

**Validate PCAP file:**
```bash
# Exec into backend container
docker compose exec backend bash

# Manually run conversion
hcxpcapngtool /data/uploads/captures/xxx/file.pcap -o /tmp/test.hc22000

# Check output
cat /tmp/test.hc22000
```

If no output, the PCAP may not contain valid handshakes.

### Out of Memory

**Symptoms:**
- Containers being killed
- Jobs failing with no error
- System becomes unresponsive

**Solutions:**

1. **Reduce concurrent jobs:**
```bash
# In .env
HASHCAT_MAX_CONCURRENT_JOBS=1
```

2. **Limit container memory:**
```yaml
# In docker-compose.yml
services:
  backend:
    mem_limit: 2g
```

3. **Increase system resources:**
- Add more RAM
- Use swap space
- Reduce hashcat workload profile

### Database Corruption

**Symptoms:**
- Query errors
- Connection failures
- Inconsistent data

**Recovery:**

1. **Stop services:**
```bash
docker compose down
```

2. **Backup current database:**
```bash
docker compose up -d db
docker exec autopwn-db-1 pg_dump -U autopwn autopwn > corrupt_backup.sql
docker compose down
```

3. **Restore from backup:**
```bash
docker compose up -d db
gunzip -c /backups/autopwn/latest.sql.gz | \
  docker exec -i autopwn-db-1 psql -U autopwn autopwn
docker compose up -d
```

### Performance Issues

**Symptoms:**
- Slow UI
- Jobs taking too long
- High CPU usage

**Optimizations:**

1. **Increase worker concurrency:**
```bash
# In .env
CONVERSION_QUEUE_CONCURRENCY=4
GENERATION_QUEUE_CONCURRENCY=3
```

2. **Optimize hashcat workload:**
```bash
# Lower workload for less intensive jobs
HASHCAT_DEFAULT_WORKLOAD=2
```

3. **Database tuning:**

Add to `docker-compose.yml`:
```yaml
services:
  db:
    environment:
      - POSTGRES_SHARED_BUFFERS=256MB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
      - POSTGRES_WORK_MEM=16MB
```

4. **Use SSD storage:**
- Move `/data` to SSD
- Improves file I/O significantly

### Getting Help

If you're still experiencing issues:

1. **Check the logs** thoroughly
2. **Search GitHub issues**: [github.com/yourusername/autopwn/issues](https://github.com/yourusername/autopwn/issues)
3. **Open a new issue** with:
   - Docker version: `docker --version`
   - OS and version
   - Full error logs
   - Steps to reproduce
   - Environment variables (sanitized, no secrets!)

## Next Steps

- [API Documentation](./API.md) - Learn the REST API
- [Database Schema](./DATABASE.md) - Understand the data model
- [Development Guide](./DEVELOPMENT.md) - Contribute to autopwn
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
