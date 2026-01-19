# CrackHouse

Professional WPA/WPA2 network security testing platform for authorized penetration testing.

## Overview

CrackHouse is a web application for security professionals to test and audit wireless network security. Upload PCAP files, extract handshakes/PMKIDs, and leverage hashcat for password recovery.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- PCAP file processing with automatic handshake/PMKID extraction
- WPA/WPA2 password cracking with hashcat integration
- Dictionary management (upload, merge, generate wordlists)
- Background job processing with BullMQ and Redis
- Real-time WebSocket progress updates
- Comprehensive API testing and E2E tests

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start services (PostgreSQL, Redis)
docker compose up -d

# Run migrations
cd apps/api && pnpm db:push

# Start dev servers
pnpm dev
```

Access at http://localhost:3000

### Production

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment instructions.

## Project Structure

```
crackhouse/
├── apps/
│   ├── api/          # Hono backend API
│   └── web/          # Next.js frontend
├── packages/
│   ├── ui/           # Shared UI components
│   ├── typescript-config/
│   └── eslint-config/
└── docs/
```

## Tech Stack

**Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
**Backend**: Hono, PostgreSQL, Drizzle ORM, Better Auth
**Infrastructure**: Docker, Redis, BullMQ, hashcat

## Documentation

- [Development Guide](docs/DEVELOPMENT.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Testing

```bash
# API tests
cd apps/api && pnpm test

# E2E tests (from repo root)
pnpm test:e2e
```

## Legal Disclaimer

**This tool is for authorized security testing only.**

- Only test networks you own or have explicit permission to test
- Unauthorized access to networks is illegal
- Use responsibly and ethically

## License

MIT License - see [LICENSE](LICENSE) for details.
