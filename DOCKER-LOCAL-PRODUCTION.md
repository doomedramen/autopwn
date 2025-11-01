# AutoPWN Local Production Deployment Guide

This guide helps you deploy and test a production-like AutoPWN setup locally before deploying to actual production.

## Overview

The local production setup mimics a real production environment with:
- Production Docker images (optimized for size and security)
- Nginx reverse proxy
- PostgreSQL and Redis with production configurations
- Resource limits and health checks
- Security headers and rate limiting

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of available RAM
- 10GB of free disk space

## Quick Start

1. **Environment Setup**
   ```bash
   # Copy the production environment template
   cp .env.production.local .env.production.local.custom

   # Edit the environment file with your secure values
   nano .env.production.local.custom
   ```

2. **Generate Secure Secrets**
   ```bash
   # Generate secure secrets (run these commands and replace in your .env file)
   openssl rand -base64 32  # For AUTH_SECRET
   openssl rand -base64 32  # For JWT_SECRET
   ```

3. **Deploy Services**
   ```bash
   # Deploy all services
   ./scripts/deploy-local-production.sh deploy
   ```

4. **Verify Deployment**
   ```bash
   # Check service status
   ./scripts/deploy-local-production.sh status

   # Check service health
   ./scripts/deploy-local-production.sh health

   # View logs
   ./scripts/deploy-local-production.sh logs
   ```

## Service URLs

After deployment, services will be available at:

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **Nginx (Reverse Proxy)**: http://localhost
- **Database Admin** (if tools profile enabled): http://localhost:1337

## Configuration Files

- `docker-compose.local.yml` - Production-like Docker Compose configuration
- `.env.production.local` - Production environment variables
- `config/nginx.local.conf` - Nginx reverse proxy configuration
- `Dockerfile` - Multi-stage build for API service
- `Dockerfile.web` - Multi-stage build for Web service

## Manual Commands

If you prefer to use Docker Compose directly:

```bash
# Start all services
docker-compose -f docker-compose.local.yml up --build -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker-compose.local.yml down

# Remove volumes (WARNING: This deletes all data)
docker-compose -f docker-compose.local.yml down -v
```

## Development vs Production

| Feature | Development | Local Production |
|---------|-------------|------------------|
| Build Target | Development | Production |
| Environment Variables | .env.local | .env.production.local |
| Hot Reload | Enabled | Disabled |
| Source Maps | Enabled | Disabled |
| Resource Limits | None | Enabled |
| Nginx Proxy | No | Yes |
| Health Checks | Basic | Comprehensive |

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :5432
lsof -i :6379

# Stop conflicting services or change ports in .env.production.local
```

### Build Failures
If builds fail:
```bash
# Clean Docker cache
docker system prune -f

# Rebuild without cache
docker-compose -f docker-compose.local.yml build --no-cache
```

### Database Issues
If database has issues:
```bash
# Check database logs
docker-compose -f docker-compose.local.yml logs database

# Reset database (WARNING: Deletes all data)
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up --build -d database
```

### Health Check Failures
If services don't become healthy:
```bash
# Check individual service health
docker exec autopwn-api-prod-local curl -f http://localhost:3001/health
docker exec autopwn-web-prod-local curl -f http://localhost:3000

# Check resource usage
docker stats
```

## Security Notes

⚠️ **Important Security Reminders:**

1. **Change Default Secrets**: Always replace the default `AUTH_SECRET` and `JWT_SECRET` with secure values
2. **Use Localhost**: This setup is designed for local testing only
3. **Don't Expose Ports**: Don't bind ports to 0.0.0.0 in production
4. **Update CORS**: Configure CORS origin for your production domain
5. **Database Security**: Use strong database passwords in production

## Performance Testing

Once deployed, you can test performance:

```bash
# Load test the API
ab -n 1000 -c 10 http://localhost:3001/health

# Test frontend load
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000
```

## Production Deployment Checklist

Before deploying to actual production, ensure:

- [ ] All secrets are replaced with secure values
- [ ] Database is properly backed up
- [ ] SSL certificates are configured
- [ ] Domain names are configured
- [ ] Monitoring and logging are set up
- [ ] Resource limits are appropriate for your infrastructure
- [ ] Security scanning is performed
- [ ] Load testing is completed

## Scripts Reference

- `./scripts/deploy-local-production.sh deploy` - Deploy all services
- `./scripts/deploy-local-production.sh status` - Show service status
- `./scripts/deploy-local-production.sh health` - Check service health
- `./scripts/deploy-local-production.sh logs` - Show recent logs
- `./scripts/deploy-local-production.sh cleanup` - Stop and remove services

## Support

For issues with the local production setup:

1. Check the troubleshooting section above
2. Review service logs for error messages
3. Verify all environment variables are set correctly
4. Ensure Docker has sufficient resources allocated

## Next Steps

Once your local production test is successful:

1. Update environment variables for your production domain
2. Configure SSL certificates
3. Set up monitoring and alerting
4. Plan your production deployment strategy
5. Test backup and recovery procedures