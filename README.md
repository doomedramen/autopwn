# CrackHouse 🔓

> **Professional WPA/WPA2 Network Security Testing Platform**

CrackHouse is a modern, full-stack web application for security professionals to test and audit WPA/WPA2 wireless network security. Built with cutting-edge technologies and designed for ease of use, it streamlines the process of capturing, analyzing, and testing wireless network security.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/yourusername/crackhouse/releases)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](DEPLOYMENT.md)

## ✨ Features

### Core Functionality
- **📡 PCAP File Processing**: Upload and analyze wireless capture files with automatic handshake/PMKID extraction
- **🔐 WPA/WPA2 Cracking**: Integrated hashcat engine with real-time progress tracking
- **📚 Dictionary Management**: Upload, merge, validate, and manage wordlist dictionaries
- **⚡ Background Job Processing**: Asynchronous job queue with BullMQ and Redis
- **👁️ Real-Time Progress**: Live WebSocket updates with ETA, speed, and detailed metrics
- **🎯 Network Management**: Track and organize discovered wireless networks

### User Experience
- **🎨 Modern UI**: Clean, responsive interface built with Next.js 16 and Tailwind CSS
- **🔒 Secure Authentication**: Better Auth integration with email/password and session management
- **📊 Progress Visualization**: Real-time job progress with hashcat metrics and statistics
- **🎛️ Job Control**: Pause, resume, and cancel jobs with queue management
- **📈 Analytics**: Track job history, success rates, and processing statistics

### Technical Highlights
- **🚀 High Performance**: Optimized for speed with streaming file processing
- **🐳 Docker Ready**: Complete containerization with production-ready compose files
- **🔄 Real-Time Updates**: WebSocket integration for live progress and notifications
- **💾 Robust Data Layer**: PostgreSQL with Drizzle ORM and full migration support
- **🎭 Type Safety**: End-to-end TypeScript with Zod validation
- **🧪 Testing**: Comprehensive API tests and E2E tests with Playwright

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- 4GB+ RAM (8GB+ recommended)
- 20GB+ disk space

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/crackhouse.git
cd crackhouse
```

2. **Copy environment file**
```bash
cp .env.example .env
```

3. **Start development services**
```bash
docker-compose up -d
```

4. **Install dependencies**
```bash
pnpm install
```

5. **Run migrations**
```bash
cd apps/api && pnpm db:migrate
```

6. **Start development servers**
```bash
# Terminal 1 - API
cd apps/api && pnpm dev

# Terminal 2 - Web
cd apps/web && pnpm dev

# Terminal 3 - Worker
cd apps/api && pnpm worker
```

7. **Access the application**
- Web: http://localhost:3000
- API: http://localhost:3001
- Database: localhost:5432
- Redis: localhost:6379

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive production deployment guide.

**Quick production start:**
```bash
cp .env.production.example .env.production
# Edit .env.production with your values
docker-compose -f docker-compose.prod.yml up -d
docker exec -it crackhouse-api-prod pnpm db:migrate
```

## 📁 Project Structure

```
crackhouse/
├── apps/
│   ├── api/              # Hono backend API
│   │   ├── src/
│   │   │   ├── routes/   # API routes
│   │   │   ├── workers/  # Background job processors
│   │   │   ├── db/       # Database schema and migrations
│   │   │   ├── lib/      # Utilities and helpers
│   │   │   └── middleware/
│   │   └── __tests__/    # API tests
│   └── web/              # Next.js frontend
│       ├── app/          # Next.js app router
│       ├── components/   # React components
│       ├── lib/          # Client utilities
│       └── tests/        # E2E tests (Playwright)
├── packages/
│   ├── ui/               # Shared UI components (shadcn/ui)
│   ├── typescript-config/
│   └── eslint-config/
├── docker-compose.yml         # Production compose (uses registry images)
└── docs/                      # Documentation
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Forms**: React Hook Form + Zod
- **State**: TanStack Query
- **Real-time**: WebSocket
- **Testing**: Playwright

### Backend
- **Runtime**: Node.js 25 with tsx
- **Framework**: Hono (high-performance HTTP router)
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Cache/Queue**: Redis 7 + BullMQ
- **Auth**: Better Auth
- **Validation**: Zod
- **Testing**: Vitest

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx (recommended)
- **Process Manager**: PM2 (optional)
- **Monitoring**: Docker logging + custom health checks

### Core Tools
- **Hashcat**: Password cracking engine
- **PCAP Processing**: Custom parsers for WPA handshakes/PMKIDs
- **File Processing**: Streaming for memory efficiency

## 📖 Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Local setup, contributing, code standards
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment, Docker, environment configuration

## 🧪 Testing

### API Tests
```bash
cd apps/api
pnpm test          # Run tests with watch mode
pnpm test:run      # Run tests once
pnpm test:coverage # Generate coverage report
```

### E2E Tests
```bash
cd apps/web
pnpm test:e2e          # Run E2E tests
pnpm test:e2e:ui       # Run with Playwright UI
pnpm test:e2e:headed   # Run in headed mode
```

## 🔒 Security

### Best Practices
- Strong password hashing with bcrypt
- JWT-based authentication
- CSRF protection
- Rate limiting on sensitive endpoints
- Input validation with Zod
- SQL injection prevention via parameterized queries
- XSS prevention via React's built-in escaping

### Recommendations
- Use HTTPS in production
- Keep secrets in environment variables
- Regular dependency updates
- Monitor logs for suspicious activity
- Implement backup strategy
- Use strong passwords for all services

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits focused and atomic
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Legal Disclaimer

**IMPORTANT**: This tool is designed for **authorized security testing only**.

- Only test networks you own or have explicit permission to test
- Unauthorized access to computer networks is illegal
- The developers assume no liability for misuse of this software
- Use responsibly and ethically

By using this software, you agree to use it only for legal and authorized purposes.

## 🙏 Acknowledgments

- [hashcat](https://hashcat.net/hashcat/) - The world's fastest password cracker
- [Hono](https://hono.dev/) - Ultrafast web framework
- [Next.js](https://nextjs.org/) - React framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Better Auth](https://www.better-auth.com/) - Auth for TypeScript
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

## 📧 Contact

- GitHub Issues: [Report a bug or request a feature](https://github.com/yourusername/crackhouse/issues)
- Email: your-email@example.com
- Twitter: [@yourhandle](https://twitter.com/yourhandle)

---

<p align="center">Made with care by the CrackHouse team</p>
