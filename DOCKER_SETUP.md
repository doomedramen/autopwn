# Docker Setup Guide

## Development Setup

For local development:
```bash
docker-compose up -d
```

## Production Setup

For production deployment:
```bash
# Use production configuration
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration Notes

### Environment Variables
- `PUID=1000` - User ID for file permissions
- `PGID=1000` - Group ID for file permissions
- `TZ=Etc/UTC` - Timezone setting

### Volume Structure
- `./uploads_data` - PCAP and dictionary uploads
- `./jobs_data` - Job processing files
- `postgres_data` - PostgreSQL database data (named volume)

### Production Customization
Update the following in `docker-compose.prod.yml`:
- `BETTER_AUTH_SECRET` - Change to a secure secret
- `NODE_ENV` - Set to 'production' (already configured)

Note: URL configuration is now automatic - no need to set NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL

### Fresh Database Start
To start with a fresh database:
```bash
docker-compose down -v
docker-compose up -d
```

### Container Management
- Containers will automatically restart on failure (`restart: unless-stopped`)
- Container names: `autopwn-app`, `autopwn-postgres`
- Default port: 3000