# AutoPWN Troubleshooting Guide

This comprehensive troubleshooting guide helps resolve common issues encountered when developing, testing, and deploying AutoPWN.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Docker Issues](#docker-issues)
- [Database Problems](#database-problems)
- [Redis Issues](#redis-issues)
- [Authentication & Security](#authentication--security)
- [File Upload Problems](#file-upload-problems)
- [Testing Issues](#testing-issues)
- [Performance Problems](#performance-problems)
- [Development Environment Issues](#development-environment-issues)
- [Network & Connectivity](#network--connectivity)
- [Common Error Messages](#common-error-messages)

## Quick Diagnostics

Start here for rapid problem identification:

```bash
# Check system status
./scripts/docker-dev.sh status

# Run basic health checks
curl -f http://localhost:3001/health || echo "❌ API unhealthy"
curl -f http://localhost:3000 || echo "❌ Web unhealthy"

# Check Docker status
docker system info
docker-compose ps
```

## Docker Issues

### Docker Not Starting

**Symptoms:** `docker: command not found`, connection errors
**Solutions:**

1. **Check Docker Desktop**
   ```bash
   # macOS/Windows
   open -a Docker
   # Wait for Docker to fully start
   docker info
   ```

2. **Check Docker daemon (Linux)**
   ```bash
   sudo systemctl status docker
   sudo systemctl start docker
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Check Docker resources**
   - **macOS:** Docker Desktop → Settings → Resources → Increase memory to 4GB+
   - **Windows:** Docker Desktop → Settings → Resources → WSL Integration
   - **Linux:** Check available memory: `free -h`

### Container Fails to Start

**Symptoms:** Exit codes, container restarts, "unhealthy" status
**Solutions:**

1. **Check container logs**
   ```bash
   ./scripts/docker-dev.sh logs [service-name]
   # Or directly
   docker-compose logs [service-name]
   ```

2. **Check for port conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :3001
   lsof -i :5432
   lsof -i :6379

   # Kill conflicting processes
   kill -9 <PID>
   ```

3. **Clean and restart**
   ```bash
   # Full reset
   ./scripts/docker-dev.sh clean
   ./scripts/docker-dev.sh start
   ```

### Docker Build Failures

**Symptoms:** Build errors, layer cache issues, "context canceled"
**Solutions:**

1. **Rebuild without cache**
   ```bash
   ./scripts/docker-dev.sh rebuild
   ```

2. **Check disk space**
   ```bash
   df -h
   # Clean Docker if needed
   docker system prune -a
   ```

3. **Check file permissions**
   ```bash
   # Fix ownership if needed
   sudo chown -R $USER:$USER ./uploads
   chmod -R 755 ./uploads
   ```

### Volume Issues

**Symptoms:** Data loss, permission errors, "permission denied"
**Solutions:**

1. **PostgreSQL Version Conflict (Common)**
   ```bash
   # Clean volumes completely
   docker-compose down -v
   docker volume prune -f
   ./scripts/docker-dev.sh start
   ```

2. **Fix volume permissions**
   ```bash
   # Find and fix volume permissions
   docker volume inspect autopwn_postgres_data_development | grep Mountpoint
   sudo chown -R 999:999 <mountpoint>
   ```

## Database Problems

### Connection Refused

**Symptoms:** `ECONNREFUSED`, connection timeout
**Solutions:**

1. **Check database is running**
   ```bash
   ./scripts/docker-dev.sh status
   docker-compose ps database
   ```

2. **Verify connection string**
   ```bash
   # Test connection manually
   docker-compose exec database psql -U postgres -d autopwn_development -c "SELECT 1;"
   ```

3. **Check DATABASE_URL format**
   ```bash
   # Correct format:
   postgresql://postgres:password@localhost:5432/autopwn_development
   # NOT: postgres://localhost:5432/autopwn_development
   ```

### Database Not Initialized

**Symptoms:** `relation "users" does not exist`, schema errors
**Solutions:**

1. **Run database migrations**
   ```bash
   ./scripts/docker-dev.sh shell api
   # Inside container:
   pnpm db:migrate
   pnpm db:seed-superuser
   ```

2. **Recreate database completely**
   ```bash
   # Destructive but complete reset
   ./scripts/docker-dev.sh clean
   ./scripts/docker-dev.sh start
   ./scripts/docker-dev.sh shell api
   # Inside container:
   pnpm db:migrate && pnpm db:seed-superuser
   ```

### Database Performance Issues

**Symptoms:** Slow queries, timeouts
**Solutions:**

1. **Check database logs**
   ```bash
   ./scripts/docker-dev.sh logs database
   ```

2. **Analyze slow queries**
   ```bash
   ./scripts/docker-dev.sh shell api
   # Inside container:
   pnpm db:studio  # Open Drizzle Studio
   ```

3. **Increase PostgreSQL memory**
   ```bash
   # Edit docker-compose.yml
   environment:
     - POSTGRES_SHARED_BUFFERS=256MB
     - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
   ```

## Redis Issues

### Connection Refused

**Symptoms:** Redis connection errors, ECONNREFUSED
**Solutions:**

1. **Check Redis is running**
   ```bash
   ./scripts/docker-dev.sh status
   docker-compose ps redis
   ```

2. **Test Redis connection**
   ```bash
   docker-compose exec redis redis-cli ping
   # Should return: PONG
   ```

3. **Check Redis URL format**
   ```bash
   # Correct format:
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

### Redis Memory Issues

**Symptoms:** OOM errors, slow performance
**Solutions:**

1. **Check Redis memory usage**
   ```bash
   ./scripts/docker-dev.sh shell redis
   redis-cli info memory
   ```

2. **Clear Redis cache**
   ```bash
   docker-compose exec redis redis-cli FLUSHDB
   ```

3. **Increase Redis memory limit**
   ```bash
   # Edit config/redis.conf
   maxmemory 512mb
   ```

## Authentication & Security

### Authentication Not Working

**Symptoms:** 401 errors, login failures, token issues
**Solutions:**

1. **Check AUTH_SECRET and JWT_SECRET**
   ```bash
   # Verify secrets are set and long enough (32+ chars)
   grep AUTH_SECRET .env
   grep JWT_SECRET .env
   ```

2. **Clear browser auth data**
   ```bash
   # Clear cookies, localStorage, sessionStorage
   # Or use incognito/private window
   ```

3. **Check superuser exists**
   ```bash
   ./scripts/docker-dev.sh db
   # Inside PostgreSQL:
   SELECT * FROM users WHERE role = 'superuser';
   ```

4. **Recreate superuser**
   ```bash
   ./scripts/docker-dev.sh shell api
   pnpm db:seed-superuser
   ```

### CORS Errors

**Symptoms:** Cross-origin blocked, preflight failures
**Solutions:**

1. **Check CORS configuration**
   ```bash
   grep CORS_ORIGIN .env
   # Should match your frontend URL
   CORS_ORIGIN=http://localhost:3000
   ```

2. **Verify frontend is making requests to correct URL**
   ```bash
   # Check browser network tab
   # API requests should go to http://localhost:3001
   ```

### Rate Limiting Issues

**Symptoms:** 429 errors, "Too many requests"
**Solutions:**

1. **Check rate limit configuration**
   ```bash
   grep RATE_LIMIT .env
   # Default limits:
   RATE_LIMIT_WINDOW=900000  # 15 minutes
   RATE_LIMIT_MAX=100
   ```

2. **Clear rate limit counters**
   ```bash
   # Restart Redis to clear in-memory rate limits
   docker-compose restart redis
   ```

3. **Whitelist your IP (if needed)**
   ```bash
   # In development, you might need to bypass rate limiting
   # Edit middleware/rateLimit.ts to increase limits
   ```

## File Upload Problems

### Upload Fails

**Symptoms:** File upload errors, "File too large", permission denied
**Solutions:**

1. **Check file size limits**
   ```bash
   grep MAX_FILE_SIZE .env
   # Default: 100MB
   # Check actual uploaded file size
   ```

2. **Check upload directory permissions**
   ```bash
   ls -la ./uploads
   # Fix permissions if needed
   chmod -R 755 ./uploads
   chown -R 1001:1001 ./uploads  # API user UID:GID
   ```

3. **Check allowed file types**
   ```bash
   # For PCAP files: .pcap, .cap
   # For dictionaries: .txt, .dic, .wordlist
   # Check file extension
   ```

### Security Scanning Issues

**Symptoms:** Files quarantined, security scan failures
**Solutions:**

1. **Check security scan logs**
   ```bash
   ./scripts/docker-dev.sh logs api | grep "security"
   ```

2. **Temporarily disable scanning (for development)**
   ```bash
   # Edit middleware/fileSecurity.ts
   scanFiles: false
   ```

3. **Check file content**
   ```bash
   # Ensure files don't contain suspicious content
   hexdump -C yourfile.pcap | head
   ```

## Testing Issues

### Tests Fail to Start

**Symptoms:** Test runner errors, "Cannot find module"
**Solutions:**

1. **Check test environment is running**
   ```bash
   ./scripts/docker-test.sh status
   ./scripts/docker-test.sh start
   ```

2. **Run test setup**
   ```bash
   ./scripts/docker-test.sh setup
   ```

3. **Check package dependencies**
   ```bash
   ./scripts/docker-test.sh shell test-runner
   # Inside container:
   pnpm install
   pnpm build
   ```

### Integration Test Failures

**Symptoms:** Database connection errors in tests, port conflicts
**Solutions:**

1. **Check test database is separate**
   ```bash
   # Test environment should use different ports:
   # Database: 5433 (not 5432)
   # Redis: 6380 (not 6379)
   ```

2. **Clean test environment**
   ```bash
   ./scripts/docker-test.sh clean
   ./scripts/docker-test.sh start
   ./scripts/docker-test.sh setup
   ```

3. **Run specific test file**
   ```bash
   ./scripts/docker-test.sh shell test-runner
   # Inside container:
   pnpm test:unit src/middleware/auth.test.ts
   ```

### E2E Test Issues

**Symptoms:** Playwright timeouts, browser not found
**Solutions:**

1. **Install Playwright browsers**
   ```bash
   pnpm playwright install
   pnpm playwright install-deps
   ```

2. **Check browser permissions**
   ```bash
   # Docker needs access to display for headed tests
   # Or use headless mode
   Xvfb :99 &
   export DISPLAY=:99
   ```

3. **Increase test timeouts**
   ```bash
   # Edit Playwright config
   timeout: 30000  # 30 seconds instead of default
   ```

## Performance Problems

### Slow Application Startup

**Symptoms:** Application takes >30 seconds to start
**Solutions:**

1. **Check database connection time**
   ```bash
   ./scripts/docker-dev.sh logs api
   # Look for database connection messages
   ```

2. **Check file system permissions**
   ```bash
   # Slow startup often due to permission checks
   ls -la ./uploads
   ```

3. **Increase startup timeout in Docker**
   ```bash
   # Edit docker-compose.yml
   healthcheck:
     start_period: 120s  # Increase from 60s
   ```

### High Memory Usage

**Symptoms:** Out of memory errors, system slowdown
**Solutions:**

1. **Check memory usage**
   ```bash
   docker stats
   # Check individual container memory usage
   ```

2. **Limit container memory**
   ```bash
   # Edit docker-compose.yml
   services:
     api:
       deploy:
         resources:
           limits:
             memory: 1G
   ```

3. **Optimize Node.js memory**
   ```bash
   # Edit Dockerfile
   ENV NODE_OPTIONS="--max-old-space-size=1024"
   ```

## Development Environment Issues

### Hot Reload Not Working

**Symptoms:** Code changes not reflected, need to restart manually
**Solutions:**

1. **Check volume mounts**
   ```bash
   docker-compose config | grep -A5 volumes
   # Should show local directories mounted
   ```

2. **Check file permissions**
   ```bash
   # Ensure Docker can watch files
   ls -la ./apps/api/src
   ```

3. **Check for file watching limits**
   ```bash
   # macOS: Increase file limits
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   # Linux version
   ```

### Node.js Version Conflicts

**Symptoms:** "Node version mismatch", module loading errors
**Solutions:**

1. **Check Node version in container**
   ```bash
   ./scripts/docker-dev.sh shell api
   node --version
   # Should match what's in package.json engines
   ```

2. **Use consistent Node version**
   ```bash
   # Dockerfile should use specific version
   FROM node:20-alpine  # Not just 'node:alpine'
   ```

3. **Clear npm cache**
   ```bash
   ./scripts/docker-dev.sh shell api
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## Network & Connectivity

### API Not Accessible

**Symptoms:** Connection refused, ERR_CONNECTION_REFUSED
**Solutions:**

1. **Check if API is running**
   ```bash
   ./scripts/docker-dev.sh status
   curl -f http://localhost:3001/health
   ```

2. **Check port mapping**
   ```bash
   docker-compose ps
   # Should show: 0.0.0.0:3001->3001/tcp
   ```

3. **Check firewall settings**
   ```bash
   # macOS
   sudo pfctl -sr  # Check rules
   # Linux
   sudo ufw status
   ```

### Database Not Accessible from Host

**Symptoms:** Can't connect with external tools
**Solutions:**

1. **Check port mapping**
   ```bash
   docker-compose ps database
   # Should show: 0.0.0.0:5432->5432/tcp
   ```

2. **Connect with correct host**
   ```bash
   # Use localhost, not container name
   psql -h localhost -p 5432 -U postgres -d autopwn_development
   ```

3. **Check external access**
   ```bash
   # Enable external access if needed
   # Edit docker-compose.yml
   ports:
     - "0.0.0.0:5432:5432"  # Already correct
   ```

## Common Error Messages

### "Cannot find module '@/lib/logger'"

**Solution:** Check TypeScript path mapping and build process
```bash
# Ensure workspace is built
pnpm build
# Check tsconfig.json paths
grep -A5 '"paths"' apps/api/tsconfig.json
```

### "Database URL is not set"

**Solution:** Check environment variable configuration
```bash
# Verify .env file exists and is loaded
cat .env | grep DATABASE_URL
# Should be: postgresql://postgres:password@localhost:5432/autopwn_development
```

### "Redis connection failed"

**Solution:** Check Redis service and URL configuration
```bash
# Check Redis is running
docker-compose ps redis
# Test connection
docker-compose exec redis redis-cli ping
# Check REDIS_URL in .env
```

### "File upload exceeds maximum size"

**Solution:** Check file size limits and configuration
```bash
# Check current limit
grep MAX_FILE_SIZE .env
# Check actual file size
ls -lh yourfile.pcap
# If needed, increase limit
echo "MAX_FILE_SIZE=200MB" >> .env
```

### "Port already in use"

**Solution:** Kill conflicting process or change port
```bash
# Find what's using the port
lsof -i :3000
# Kill the process
kill -9 <PID>
# Or use different port in .env
echo "PORT=3002" >> .env
```

## When All Else Fails

### Complete Reset

⚠️ **Warning:** This will delete all data!

```bash
# Complete environment reset
./scripts/docker-dev.sh clean
./scripts/docker-test.sh clean
docker system prune -a
rm -rf uploads/
mkdir -p uploads/

# Restart fresh
./scripts/docker-dev.sh start
./scripts/docker-dev.sh shell api
# Inside container:
pnpm db:migrate
pnpm db:seed-superuser
```

### Get Help

1. **Check logs first**
   ```bash
   ./scripts/docker-dev.sh logs
   ./scripts/docker-test.sh logs
   ```

2. **Run diagnostics**
   ```bash
   ./scripts/docker-dev.sh status
   curl -f http://localhost:3001/health
   docker system info
   ```

3. **Create issue with details**
   - Include OS and Docker version
   - Include exact error messages
   - Include steps to reproduce
   - Include relevant logs

---

## Environment-Specific Tips

### Development
- Use hot reload: Changes should reflect automatically
- Keep development tools running: `./scripts/docker-dev.sh tools`
- Use ./scripts/docker-dev.sh db for quick database access

### Testing
- Always run `./scripts/docker-test.sh setup` before tests
- Test environment uses different ports to avoid conflicts
- Use `./scripts/docker-test.sh clean` between test runs

### Production
- Never use development secrets in production
- Use `target: production` when building images
- Set proper resource limits and monitoring
- Use external managed services when possible

This troubleshooting guide covers the most common issues. For additional help, check the Docker validation report and project documentation.