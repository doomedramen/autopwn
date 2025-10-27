# autopwn

A web application for the Pwnagotchi ecosystem that automates WiFi handshake cracking workflows.

## Overview

autopwn is a self-hosted web platform designed for Pwnagotchi users to manage and crack WiFi handshakes captured by their devices. It provides an intuitive interface for uploading PCAP files, managing wordlists, and running distributed hashcat jobs.

## Features

### Core Functionality
- **PCAP Management**: Upload and store `.pcap` files from your Pwnagotchi
- **Automatic Conversion**: Converts PCAP files to hc22000 format using `hcxpcapngtool`
- **Network Extraction**: Automatically extracts SSIDs and BSSIDs from captures
- **Dictionary Management**:
  - Upload custom wordlists
  - Generate wordlists with advanced options:
    - Case variations (upper/lowercase)
    - Special character padding
    - Leet speak (l33t) transformations
    - Keyword-based combinations
- **Hashcat Integration**:
  - Queue-based job management
  - Support for multiple attack modes
  - Real-time job progress monitoring
  - Result tracking and history
- **Multi-User Support**:
  - Email/password authentication
  - Role-based access (Superuser, Admin, User)
  - User management dashboard

### Technical Features
- **Containerized Deployment**: Runs entirely in Docker
- **Configurable Resources**: Runtime environment variables for all settings
- **Job Queue System**: Robust BullMQ-based queue for intensive cracking jobs
- **Database-Backed**: PostgreSQL with Drizzle ORM
- **Modern Stack**: Next.js frontend with Fastify backend

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js >= 20 (for development)
- pnpm (for development)
- At least 4GB RAM (8GB+ recommended)
- CPU with good single-thread performance

### Running with Docker Compose

```bash
# Clone the repository
git clone https://github.com/DoomedRamen/autopwn.git
cd autopwn

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env

# Start the application
docker compose up -d
```

Visit `http://localhost:3000` and log in with the default superuser credentials (displayed in logs on first run).

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Documentation Index](docs/README.md)** - Complete documentation overview
- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[Development Guide](docs/DEVELOPMENT.md)** - Development workflow and best practices
- **[Testing Guide](docs/TESTING.md)** - Testing strategy and running tests
- **[Docker Deployment](docs/DOCKER_DEPLOYMENT.md)** - Production deployment with Docker
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design

## Development

### Setting up for Development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development services:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

3. Run the development servers:
   ```bash
   pnpm dev
   ```

### Testing

The project uses Playwright for end-to-end testing with a comprehensive test infrastructure. All tests run with `NODE_ENV=test` to ensure consistent, reproducible behavior.

**Development Workflow (Recommended for iterative testing):**

```bash
# 1. Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# 2. Start test infrastructure
pnpm test:infra:up

# 3. Run tests (fast, run many times)
pnpm test

# 4. Stop infrastructure when done
pnpm test:infra:down
```

**One-off / CI Testing (Full automation):**

```bash
# 1. Install Playwright browsers (one-time setup)
pnpm test:e2e:install

# 2. Run complete test suite with automatic setup/cleanup
pnpm test:full
```

This automatically handles:
- ✅ Fresh Docker infrastructure (PostgreSQL + Redis)
- ✅ Database migrations and seeding
- ✅ E2E test execution
- ✅ Automatic cleanup (containers + volumes)

**Advanced Test Commands:**

```bash
# Run tests in CI mode (preserve infrastructure on failure)
pnpm test:ci

# Run tests without cleanup (for debugging)
pnpm test:no-cleanup

# Run with UI for debugging
pnpm test:e2e:ui

# Run in debug mode (step through tests)
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report
```

**Cleanup Commands:**

```bash
# Clean up test infrastructure (containers + volumes)
pnpm test:cleanup

# Clean up ALL old test volumes (interactive)
pnpm test:cleanup:volumes
```

**Test Environment Details:**

- Uses dedicated `.env.test` file with isolated test configurations
- Test database (autopwn_test) on port 5433
- Test Redis instance on port 6380
- Superuser credentials: `admin@autopwn.local` / `autopwn-test-password`
- All tests automatically run with `NODE_ENV=test` via turbo + pnpm pipeline

For complete testing documentation, see [docs/TESTING.md](./docs/TESTING.md)

## Documentation

- [🔧 Troubleshooting Guide](./TROUBLESHOOTING.md) - Comprehensive troubleshooting and repair guide
- [🐳 Docker Setup](./DOCKER.md) - Docker configuration and deployment guide
- [🏗️ Architecture Overview](./docs/ARCHITECTURE.md) - System design and components
- [📋 Setup Guide](./docs/SETUP.md) - Installation and configuration
- [🔌 API Documentation](./docs/API.md) - REST API reference
- [🗄️ Database Schema](./docs/DATABASE.md) - Data model documentation
- [🚀 Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment
- [💻 Development Guide](./docs/DEVELOPMENT.md) - Contributing and local development
- [🗺️ Roadmap](./docs/ROADMAP.md) - Planned features and improvements

### Quick Troubleshooting

If you encounter issues, start with these commands:

```bash
# Health check
./scripts/health-check.sh

# Automatic repair
./scripts/repair-docker.sh auto

# Development environment
./scripts/docker-dev.sh start
./scripts/docker-dev.sh status

# Test environment
./scripts/docker-test.sh start
./scripts/docker-test.sh setup
```

## Environment Variables

Key configuration options (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL=postgresql://user:pass@db:5432/autopwn

# Redis (for job queue)
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production
PORT=3000

# Security
SESSION_SECRET=your-secret-here
BCRYPT_ROUNDS=12

# File Storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE=500MB

# Hashcat
HASHCAT_MAX_CONCURRENT_JOBS=2
HASHCAT_DEFAULT_WORKLOAD=3

# Dictionary Generation
MAX_DICTIONARY_SIZE=10GB
```

## Default Credentials

On first startup, a superuser account is created with credentials shown in the container logs. **Change these immediately after first login.**

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Fastify    │────▶│ PostgreSQL  │
│  (Frontend) │     │   (Backend)  │     │  (Database) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ├──────────────┐
                           │              │
                    ┌──────▼─────┐  ┌─────▼──────┐
                    │   Redis    │  │  hcxtools  │
                    │  (Queue)   │  │  hashcat   │
                    └────────────┘  └────────────┘
```

## Roadmap

- [ ] GPU support for hashcat
- [ ] S3-compatible object storage
- [ ] Advanced hashcat attack modes (mask, hybrid)
- [ ] Statistics and analytics dashboard
- [ ] Bulk PCAP upload
- [ ] API key authentication
- [ ] Webhook notifications for job completion

## Security Considerations

- Change default credentials immediately
- Use strong passwords for database and session secrets
- Keep the application behind a reverse proxy with HTTPS
- Regularly update the Docker images
- Limit exposure to trusted networks only
- Be aware: Cracked passwords are stored in plaintext in the database

## License

MIT License - See [LICENSE](./LICENSE) for details

## Contributing

Contributions are welcome! Please read [DEVELOPMENT.md](./docs/DEVELOPMENT.md) before submitting PRs.

## Support

For issues, questions, or feature requests, please use the [GitHub Issues](https://github.com/DoomedRamen/autopwn/issues) page.

## Acknowledgments

- [Pwnagotchi](https://pwnagotchi.ai/) - The amazing WiFi handshake capture device
- [hashcat](https://hashcat.net/) - Advanced password recovery
- [hcxtools](https://github.com/ZerBea/hcxtools) - Portable solution for capturing wlan traffic
