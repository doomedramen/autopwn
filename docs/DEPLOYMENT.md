# Deployment Guide

Production deployment guide for autopwn.

## Table of Contents
- [Production Considerations](#production-considerations)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring](#monitoring)
- [Backups](#backups)
- [Scaling](#scaling)
- [Security Hardening](#security-hardening)
- [Updates and Maintenance](#updates-and-maintenance)

## Production Considerations

### Hardware Requirements

**Minimum Production Setup:**
- 4 CPU cores (8+ recommended for better hashcat performance)
- 8GB RAM (16GB+ recommended)
- 100GB SSD storage (more for larger capture/dictionary collections)
- Stable network connection

**Optimal Setup:**
- 8+ CPU cores with high single-thread performance
- 16GB+ RAM
- 500GB+ NVMe SSD
- 1Gbps+ network
- Dedicated GPU (future roadmap)

### Network Requirements

**Required Ports:**
- `80` - HTTP (redirect to HTTPS)
- `443` - HTTPS
- `22` - SSH (for server management)

**Optional Ports:**
- `4000` - Backend API (if exposed directly)
- `5432` - PostgreSQL (only if exposing database externally - NOT recommended)
- `6379` - Redis (only if exposing queue externally - NOT recommended)

### Security Considerations

**Before deploying to production:**

1. ✅ Change all default passwords
2. ✅ Use strong SESSION_SECRET (min 32 random characters)
3. ✅ Enable HTTPS with valid SSL certificate
4. ✅ Set up firewall rules
5. ✅ Configure rate limiting
6. ✅ Set up automated backups
7. ✅ Enable audit logging
8. ✅ Restrict database/redis to internal network only
9. ✅ Keep software updated
10. ✅ Review legal implications of WiFi password cracking in your jurisdiction

## Docker Deployment

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  frontend:
    image: autopwn/frontend:latest
    container_name: autopwn-frontend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    networks:
      - autopwn-network
    depends_on:
      - backend
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  backend:
    image: autopwn/backend:latest
    container_name: autopwn-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - MAX_PCAP_SIZE=${MAX_PCAP_SIZE}
      - MAX_DICTIONARY_SIZE=${MAX_DICTIONARY_SIZE}
      - HASHCAT_MAX_CONCURRENT_JOBS=${HASHCAT_MAX_CONCURRENT_JOBS}
    volumes:
      - data:/data
      - logs:/var/log/autopwn
    networks:
      - autopwn-network
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  worker:
    image: autopwn/backend:latest
    container_name: autopwn-worker
    restart: unless-stopped
    command: ["npm", "run", "worker"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - HASHCAT_MAX_CONCURRENT_JOBS=${HASHCAT_MAX_CONCURRENT_JOBS}
    volumes:
      - data:/data
      - logs:/var/log/autopwn
    networks:
      - autopwn-network
    depends_on:
      - backend
      - redis
    deploy:
      resources:
        limits:
          cpus: '6.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 2G
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  db:
    image: postgres:16-alpine
    container_name: autopwn-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${DATABASE_NAME}
      - POSTGRES_USER=${DATABASE_USER}
      - POSTGRES_PASSWORD=${DATABASE_PASSWORD}
      - POSTGRES_SHARED_BUFFERS=256MB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=2GB
      - POSTGRES_WORK_MEM=16MB
      - POSTGRES_MAINTENANCE_WORK_MEM=128MB
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - autopwn-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=2GB
      -c work_mem=16MB
      -c maintenance_work_mem=128MB
      -c max_connections=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c min_wal_size=1GB
      -c max_wal_size=4GB
      -c checkpoint_completion_target=0.9

  redis:
    image: redis:7-alpine
    container_name: autopwn-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - autopwn-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: autopwn-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_cache:/var/cache/nginx
    networks:
      - autopwn-network
    depends_on:
      - frontend
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Auto-update containers
  watchtower:
    image: containrrr/watchtower
    container_name: autopwn-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_LABEL_ENABLE=true
      - WATCHTOWER_POLL_INTERVAL=86400  # Check daily
    networks:
      - autopwn-network

networks:
  autopwn-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  data:
    driver: local
    driver_opts:
      type: none
      device: /opt/autopwn/data
      o: bind
  postgres_data:
    driver: local
  redis_data:
    driver: local
  logs:
    driver: local
  nginx_cache:
    driver: local
```

### Starting Production Deployment

```bash
# Create data directory
sudo mkdir -p /opt/autopwn/data
sudo chown -R 1000:1000 /opt/autopwn/data

# Start services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check health
docker compose -f docker-compose.prod.yml ps
```

## Environment Configuration

### Production .env Template

```bash
# ============================================
# Application
# ============================================
NODE_ENV=production
APP_NAME=autopwn
APP_URL=https://autopwn.yourdomain.com

# Frontend
NEXT_PUBLIC_API_URL=https://autopwn.yourdomain.com/api

# Backend
BACKEND_PORT=4000
FRONTEND_URL=https://autopwn.yourdomain.com

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://autopwn:CHANGE_THIS_PASSWORD@db:5432/autopwn
DATABASE_NAME=autopwn
DATABASE_USER=autopwn
DATABASE_PASSWORD=CHANGE_THIS_PASSWORD
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# ============================================
# Redis
# ============================================
REDIS_URL=redis://redis:6379

# ============================================
# Security
# ============================================
SESSION_SECRET=GENERATE_A_VERY_LONG_RANDOM_STRING_HERE_AT_LEAST_64_CHARS
SESSION_MAX_AGE=604800
BCRYPT_ROUNDS=12

# CORS (your domain only)
CORS_ORIGINS=https://autopwn.yourdomain.com

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# ============================================
# File Storage
# ============================================
UPLOAD_DIR=/data/uploads
PROCESSED_DIR=/data/processed
GENERATED_DIR=/data/generated
HASHCAT_DIR=/data/hashcat
LOG_DIR=/var/log/autopwn

# Production limits
MAX_PCAP_SIZE=524288000        # 500MB
MAX_DICTIONARY_SIZE=10737418240  # 10GB
MAX_GENERATED_DICT_SIZE=21474836480  # 20GB

# ============================================
# Hashcat
# ============================================
HASHCAT_MAX_CONCURRENT_JOBS=3
HASHCAT_DEFAULT_WORKLOAD=3
HASHCAT_JOB_TIMEOUT=86400

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
PRETTY_LOGS=false  # Use JSON logs in production

# ============================================
# Monitoring
# ============================================
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues
```

## Reverse Proxy Setup

### nginx Configuration

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 500M;  # Match MAX_PCAP_SIZE

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=5r/m;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name autopwn.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name autopwn.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Frontend (Next.js)
        location / {
            proxy_pass http://frontend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api {
            proxy_pass http://backend:4000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Rate limiting for API
            limit_req zone=api_limit burst=20 nodelay;
        }

        # File upload endpoint (higher limits)
        location /api/v1/captures/upload {
            proxy_pass http://backend:4000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Higher timeout for large uploads
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;

            # Rate limit uploads
            limit_req zone=upload_limit burst=3 nodelay;
        }

        # Health check endpoint (no rate limit)
        location /health {
            proxy_pass http://backend:4000/health;
            access_log off;
        }
    }
}
```

### Traefik Configuration

Alternative to nginx - `docker-compose.traefik.yml`:

```yaml
services:
  traefik:
    image: traefik:v2.10
    container_name: autopwn-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/acme.json:/acme.json
      - traefik_logs:/var/log/traefik
    networks:
      - autopwn-network
    labels:
      - "traefik.enable=true"

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`autopwn.yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

  backend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`autopwn.yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=4000"
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot (nginx)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d autopwn.yourdomain.com

# Certificates will be in /etc/letsencrypt/live/autopwn.yourdomain.com/

# Copy to nginx directory
sudo cp /etc/letsencrypt/live/autopwn.yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/autopwn.yourdomain.com/privkey.pem ./nginx/ssl/

# Set permissions
sudo chmod 644 ./nginx/ssl/fullchain.pem
sudo chmod 600 ./nginx/ssl/privkey.pem

# Auto-renewal (cron)
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/autopwn.yourdomain.com/*.pem /opt/autopwn/nginx/ssl/ && docker compose -f /opt/autopwn/docker-compose.prod.yml restart nginx
```

### Let's Encrypt with Traefik

Traefik handles SSL automatically. Create `traefik/traefik.yml`:

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@yourdomain.com
      storage: /acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    exposedByDefault: false
```

## Monitoring

### Health Checks

**Endpoint:** `GET /health`

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-19T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "accessible"
  }
}
```

**Monitoring script:**

```bash
#!/bin/bash
# healthcheck.sh

URL="https://autopwn.yourdomain.com/health"
EXPECTED_STATUS="healthy"

RESPONSE=$(curl -s $URL)
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$STATUS" != "$EXPECTED_STATUS" ]; then
  echo "Health check failed: $RESPONSE"
  # Send alert (email, Slack, etc.)
  exit 1
fi

echo "Health check passed"
exit 0
```

Add to cron:
```bash
*/5 * * * * /opt/autopwn/healthcheck.sh
```

### Logging

**View aggregated logs:**
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Search logs
docker compose -f docker-compose.prod.yml logs backend | grep ERROR
```

**Log rotation:**

Create `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:
```bash
sudo systemctl restart docker
```

### Resource Monitoring

**Monitor container resources:**
```bash
docker stats autopwn-backend autopwn-worker autopwn-db autopwn-redis
```

**Monitor disk usage:**
```bash
du -sh /opt/autopwn/data/*
df -h /opt/autopwn
```

## Backups

### Automated Backup Script

Create `/opt/autopwn/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/autopwn/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "[$(date)] Starting backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Backing up database..."
docker exec autopwn-db pg_dump -U autopwn autopwn | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup data directory (excluding large files)
echo "Backing up data directory..."
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" \
  --exclude='/opt/autopwn/data/uploads' \
  --exclude='/opt/autopwn/data/processed' \
  /opt/autopwn/data

# Backup configuration
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  /opt/autopwn/.env \
  /opt/autopwn/docker-compose.prod.yml \
  /opt/autopwn/nginx

# Remove old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Upload to S3 (optional)
# aws s3 sync "$BACKUP_DIR" s3://your-backup-bucket/autopwn/

echo "[$(date)] Backup completed successfully"
```

Make executable and schedule:
```bash
chmod +x /opt/autopwn/backup.sh

# Add to cron (daily at 2 AM)
crontab -e
0 2 * * * /opt/autopwn/backup.sh >> /opt/autopwn/backup.log 2>&1
```

### Restore from Backup

```bash
# Stop services
cd /opt/autopwn
docker compose -f docker-compose.prod.yml down

# Restore database
gunzip -c backups/db_20250119_020000.sql.gz | \
  docker exec -i autopwn-db psql -U autopwn autopwn

# Restore data
tar -xzf backups/data_20250119_020000.tar.gz -C /

# Restore config
tar -xzf backups/config_20250119_020000.tar.gz -C /

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## Scaling

### Horizontal Scaling

**Multiple worker containers:**

```yaml
worker:
  deploy:
    replicas: 3  # Run 3 worker instances
```

**Load balancing backend:**

```yaml
backend:
  deploy:
    replicas: 2
```

Update nginx config for load balancing:
```nginx
upstream backend_cluster {
    server backend_1:4000;
    server backend_2:4000;
}

location /api {
    proxy_pass http://backend_cluster;
}
```

### Vertical Scaling

**Increase resources:**

```yaml
worker:
  deploy:
    resources:
      limits:
        cpus: '8.0'
        memory: 16G
```

## Security Hardening

### Firewall Configuration

**UFW (Ubuntu):**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Fail2ban

Protect against brute force:

```bash
sudo apt-get install fail2ban

# Create /etc/fail2ban/jail.local
[autopwn]
enabled = true
port = http,https
filter = autopwn
logpath = /opt/autopwn/logs/access.log
maxretry = 5
bantime = 3600
```

### Docker Security

**Run as non-root user:**

Add to Dockerfile:
```dockerfile
USER node
```

**Limit container capabilities:**
```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

## Updates and Maintenance

### Update Application

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Recreate containers
docker compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -a -f
```

### Update System

```bash
# Update OS packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker
sudo apt-get install docker-ce docker-ce-cli containerd.io
```

### Database Migrations

```bash
# Run pending migrations
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate

# Check migration status
docker compose -f docker-compose.prod.yml exec backend npm run db:status
```

### Maintenance Window

**Scheduled maintenance checklist:**

1. Announce maintenance window to users
2. Stop accepting new jobs
3. Wait for running jobs to complete
4. Create full backup
5. Stop services
6. Perform updates
7. Run database migrations
8. Start services
9. Verify health checks
10. Monitor for issues

## Disaster Recovery

### Recovery Time Objective (RTO)

**Target:** 4 hours

**Steps:**
1. Provision new server (1 hour)
2. Install dependencies (30 minutes)
3. Restore from backup (1 hour)
4. Verify and test (1.5 hours)

### Recovery Point Objective (RPO)

**Target:** 24 hours (daily backups)

For lower RPO, increase backup frequency or implement continuous backup strategy.

## Legal and Ethical Considerations

**⚠️ Important Notice:**

Before deploying autopwn:

1. **Verify legal compliance:** WiFi password cracking may be illegal in your jurisdiction without explicit authorization
2. **Use responsibly:** Only crack passwords for networks you own or have written permission to test
3. **Secure your instance:** Implement strong access controls to prevent misuse
4. **User agreements:** Consider requiring users to agree to acceptable use policy
5. **Data retention:** Be aware that cracked passwords are stored in plaintext
6. **Liability:** Understand your liability as the operator of this service

Consult with legal counsel before deploying in production.
