# AutoPWN (⌐■_■)

Modern WPA/WPA2 handshake cracker with a web dashboard. Upload `.pcap` files, select dictionaries, and run automated password cracking jobs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-24.x-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
[![Docker Worker](https://img.shields.io/docker/v/doomedramen/autopwn-worker?label=worker)](https://hub.docker.com/r/doomedramen/autopwn-worker)
[![Docker Web](https://img.shields.io/docker/v/doomedramen/autopwn-web?label=web)](https://hub.docker.com/r/doomedramen/autopwn-web)


## ⚠️ Legal Disclaimer

**For authorized security testing and educational purposes only.**
- Only use on networks you own or have explicit written permission to test
- Unauthorized access to computer networks is illegal and punishable by law
- Developers assume no liability for misuse of this software

## 🔒 Critical Security Requirements

**Before deploying AutoPWN, you MUST configure secure authentication secrets.**

### Generate a Secure BETTER_AUTH_SECRET

The default development secret **MUST NOT** be used in production. AutoPWN will **refuse to start** if you use weak or default secrets in production mode.

```bash
# Generate a secure 32+ character secret
openssl rand -base64 32
```

⚠️ **Failing to set a secure secret will result in:**
- Production server refusing to start
- Potential unauthorized access to all user data
- Complete compromise of authentication security

See the [Configuration](#configuration) section for detailed setup instructions.

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone and setup
git clone <repo>
cd autopwn
cp .env.example .env

# ⚠️ CRITICAL: Generate and configure a secure authentication secret
# This step is MANDATORY before running in production
openssl rand -base64 32

# Add the generated secret to your .env file:
# Edit .env and replace BETTER_AUTH_SECRET with your generated value

# Add dictionaries
cp /path/to/rockyou.txt volumes/dictionaries/

# Run (CPU mode)
docker-compose up -d

# Access dashboard
open http://localhost:3000
```

**🔐 Security Checklist Before First Run:**
- ✅ Generated secure BETTER_AUTH_SECRET using `openssl rand -base64 32`
- ✅ Replaced default secret in `.env` file
- ✅ Verified `.env` is listed in `.gitignore`
- ✅ Documented your secrets in a secure password manager

### GPU Support

```bash
# NVIDIA GPU
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d

# AMD GPU
docker-compose -f docker-compose.yml -f docker-compose.amd.yml up -d
```

### New Authentication System

AutoPWN now includes user authentication:
- Each user has completely isolated data (jobs, results, files)
- Email/password authentication with better-auth
- Secure session management
- Database migrated from SQLite to PostgreSQL

**First user setup:**
1. Visit `http://localhost:3000/auth/signup`
2. Create your account
3. Start uploading files and creating jobs

### Local Development

```bash
# Install dependencies
pnpm install

# Configure environment (copy and edit .env)
cp .env.example .env
# For local development, the default secret is acceptable
# For production deployment, generate a secure secret:
# openssl rand -base64 32

# Option 1: Development with Docker (Recommended)
# Uses volume mounts for hot reloading and database
docker-compose -f docker-compose.dev.yml up -d

# Option 2: Local development without Docker
# Run database (terminal 1)
docker-compose -f docker-compose.dev.yml up -d postgres

# Run backend (terminal 2)
pnpm run dev:backend

# Run web dashboard (terminal 3)
pnpm run dev:web

# Access at http://localhost:3000
```

> **Note**: The development environment allows default secrets for convenience. Production mode (NODE_ENV=production) will enforce secure secret requirements.

### Development Environment

The project now includes a **Docker-based development environment** with:

- **Hot reloading**: Code changes are immediately reflected
- **Volume mounts**: Source code is mounted into containers
- **Database**: PostgreSQL with automated migrations
- **Authentication**: better-auth with proper schema configuration
- **Debugging**: Comprehensive logging and error tracking

**Development Docker Compose:**
- `docker-compose.dev.yml` - Development environment with hot reloading
- `apps/backend/Dockerfile.dev` - Development container with dev dependencies
- Volume mounts for `./packages/shared` and `./apps/backend`
- TypeScript compilation in watch mode
- Database migrations on startup

## How It Works

1. **Upload PCAP files** via web interface or copy to `volumes/pcaps/`
2. **Add dictionaries** via web interface or copy to `volumes/dictionaries/`
3. **Create jobs** by selecting PCAP files and dictionaries
4. **Monitor progress** in real-time with speed, ETA, and live logs
5. **View results** with ESSID tracking back to source PCAP files

## Key Features

- **Modern Dashboard** - Real-time job monitoring with progress tracking
- **Batch Processing** - Merge multiple PCAPs into efficient jobs
- **Multi-GPU Support** - NVIDIA, AMD, Intel, and CPU modes
- **ESSID Tracking** - Trace cracked passwords back to source PCAP files
- **Analytics** - Job statistics, success rates, and dictionary performance
- **REST API** - Full automation and integration support

## Configuration

Edit `.env` file:

```bash
# ========================================================================
# 🔒 SECURITY CONFIGURATION - CRITICAL FOR PRODUCTION
# ========================================================================

# BETTER_AUTH_SECRET (MANDATORY - GENERATE YOUR OWN SECURE SECRET)
#
# ⚠️  DO NOT USE DEFAULT VALUES IN PRODUCTION
# ⚠️  Server will refuse to start with weak secrets when NODE_ENV=production
#
# Generate a secure secret:
#   openssl rand -base64 32
#
# Minimum requirements:
#   - At least 32 characters long
#   - Randomly generated (NOT a common word or phrase)
#   - Unique to your deployment
#   - Stored securely (use a password manager)
#
BETTER_AUTH_SECRET=REPLACE_THIS_WITH_YOUR_GENERATED_SECRET

# ========================================================================
# APPLICATION CONFIGURATION
# ========================================================================

# GPU Type: nvidia, amd, intel, cpu
HASHCAT_DEVICE_TYPE=cpu

# Paths (auto-configured for Docker and local development)
PCAPS_PATH=/data/pcaps
DICTIONARIES_PATH=/data/dictionaries
JOBS_PATH=/data/jobs

# Database (Docker sets this automatically)
DATABASE_URL=postgresql://localhost/autopwn

# Dashboard URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
```

### Security Requirements

**Production Deployment Checklist:**

1. **Generate Secure BETTER_AUTH_SECRET**
   ```bash
   openssl rand -base64 32
   ```
   - Minimum 32 characters required
   - Server validates and rejects weak/default secrets
   - Never reuse secrets across environments

2. **Never Commit Secrets to Version Control**
   - Verify `.env` is in `.gitignore`
   - Use environment variables in CI/CD
   - Store secrets in a secure vault/password manager

3. **Database Security**
   - Use strong PostgreSQL passwords
   - Restrict database access to backend only
   - Enable SSL/TLS for database connections in production

4. **HTTPS in Production**
   - Always use HTTPS for production deployments
   - Update BETTER_AUTH_URL to use `https://` protocol
   - Configure proper TLS certificates

**Environment Validation:**

AutoPWN uses [t3-env](https://env.t3.gg/) for environment validation. The server will:
- ✅ Validate all required environment variables on startup
- ✅ Enforce minimum secret length (32 characters)
- ✅ Reject known weak/default secrets in production
- ✅ Validate PostgreSQL connection strings
- ❌ **Refuse to start** if validation fails

## Documentation

- **[API Documentation](API.md)** - REST API endpoints and integration examples
- **[Usage Guide](USAGE.md)** - Detailed usage instructions and best practices
- **[Docker Hub Setup](DOCKER_HUB_SETUP.md)** - CI/CD and automated builds

## Architecture

```
AutoPWN
├── Web Dashboard (Next.js)    # File upload, job creation, monitoring, auth
├── Backend Service            # Integrated API server + job processing worker
├── PostgreSQL Database        # Job management, ESSID tracking, users
└── Authentication System      # User isolation and session management (better-auth)
```

## Tech Stack

- **Backend**: Node.js 24 + TypeScript + Hono + Hashcat
- **Web**: Next.js 15 + React 19 + Tailwind CSS + better-auth
- **Tools**: hashcat + hcxpcapngtool
- **Database**: PostgreSQL 15 + Drizzle ORM
- **Authentication**: better-auth with email/password

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

