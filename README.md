# AutoPWN

WiFi Network Analysis & Password Cracking Tool

## ⚠️ LEGAL WARNING

**This tool is intended for authorized security testing, educational purposes, and legitimate security research ONLY.**

- **Only use on networks you own or have explicit, written permission to test**
- **Unauthorized access to computer networks is illegal in most jurisdictions**
- **Users are solely responsible for complying with all applicable laws and regulations**
- **The authors assume no liability for misuse or illegal use of this software**

**Do not use this tool for any malicious or illegal activities.**

## 🚀 Quick Start

### Docker Compose (Recommended & Default Deployment)

The Docker Compose setup includes:

- **AutoPWN Application** (Next.js frontend + API)
- **PostgreSQL Database** (persistent data storage)
- **GPU Support** for each variant (NVIDIA, AMD, Intel)
- **Persistent Volumes** for data and uploads

```bash
# Clone and setup
git clone <repository-url>
cd autopwn
cp .env.docker.example .env

# Edit .env with your configuration
# Required: BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)
# Required: Change POSTGRES_PASSWORD from default
# Optional: Set LOG_LEVEL (INFO for production, DEBUG for development)
# Required: Update APP_URL to your domain/IP

# Choose your variant and start:
docker-compose -f docker-compose.cpu.yml up -d      # CPU (recommended for development)
docker-compose -f docker-compose.nvidia.yml up -d  # NVIDIA GPU
docker-compose -f docker-compose.amd.yml up -d     # AMD GPU
docker-compose -f docker-compose.intel.yml up -d   # Intel GPU

# Access at http://localhost:3000
# Initial credentials (hardcoded for first-time setup)
# Email: superuser@autopwn.local
# Username: superuser
# Password: TestPassword123!
# NOTE: Change these immediately after first login!
```

### Local Development (for testing/development only)

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your database configuration

# Setup database
createdb autopwn
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

## 📋 Requirements

### For Docker Compose Deployment (Recommended)

- **Docker** & **Docker Compose**

### For Local Development

- **Node.js** 20+
- **pnpm** package manager
- **PostgreSQL** 15+

## 🔧 Configuration

### Required Environment Variables

| Variable              | Description                       | Default                 |
| --------------------- | --------------------------------- | ----------------------- |
| `DATABASE_URL`        | PostgreSQL connection string      | Required                |
| `BETTER_AUTH_SECRET`  | Authentication secret (32+ chars) | Required                |
| `BETTER_AUTH_URL`     | Base URL for auth callbacks       | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public application URL            | `http://localhost:3000` |

### Key Security Settings

| Variable                   | Description                    | Default |
| -------------------------- | ------------------------------ | ------- |
| `MIN_PASSWORD_LENGTH`      | Minimum password length        | `8`     |
| `ACCOUNT_LOCKOUT_ATTEMPTS` | Failed attempts before lockout | `5`     |
| `SESSION_TIMEOUT`          | Session timeout in hours       | `24`    |

## 🗄️ Database Management

```bash
# Generate migrations
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open database studio
pnpm db:studio

# Reset database (DESTRUCTIVE)
pnpm db:reset
```

## 🐳 Docker Commands

### Docker Compose Commands

```bash
# View logs (example for CPU variant)
docker-compose -f docker-compose.cpu.yml logs -f

# Stop services
docker-compose -f docker-compose.cpu.yml down

# Restart services
docker-compose -f docker-compose.cpu.yml restart

# Fresh database start
docker-compose -f docker-compose.cpu.yml down -v && docker-compose -f docker-compose.cpu.yml up -d
```

**Note**: Replace `cpu.yml` with your variant file (nvidia.yml, amd.yml, intel.yml) in the commands above.

### Standalone Docker

```bash
# Build and run specific variant
docker build -f docker/Dockerfile.cpu -t autopwn:cpu .
docker run -d --name autopwn -p 3000:3000 --env-file .env autopwn:cpu
```

📖 **See [Docker Guide](docker/README.md) for complete deployment instructions.**

## 🔐 Initial Setup

### Default Superuser Credentials (First-Time Setup)

- **Email**: `superuser@autopwn.local`
- **Username**: `superuser`
- **Password**: `TestPassword123!`

### Setup Steps

1. **First Visit**: Go to http://localhost:3000/setup (automatic redirect)
2. **Create Account**: Use default credentials above to log in
3. **Change Password**: System will prompt to change the default password
4. **User Management**: Only superusers/admins can create additional users

**⚠️ IMPORTANT**: Change the default password immediately after first login!

## 🚨 Production Security Checklist

- [ ] Change `BETTER_AUTH_SECRET` to secure random value
- [ ] Update default PostgreSQL password
- [ ] Change default superuser credentials (superuser@autopwn.local / TestPassword123!)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (reverse proxy recommended)
- [ ] Regularly update dependencies

## 📚 Usage

1. **Network Analysis**: Upload PCAP files for network traffic analysis
2. **Password Cracking**: Use hashcat integration for password recovery
3. **Dictionary Management**: Upload and manage wordlists
4. **Job Management**: Monitor and control cracking jobs

## 🛠️ Development Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm format:write # Apply Prettier formatting
pnpm test         # Run tests
pnpm test:e2e     # Run E2E tests
```

## 📄 License

[License information here]

---

**⚠️ REMINDER**: This software must only be used for authorized security testing and educational purposes. Unauthorized use is illegal and unethical.
