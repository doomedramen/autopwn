# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-09

### Added - Core Features
- **Real-Time Job Progress Tracking**: Live progress updates with WebSocket integration
  - Streaming hashcat output parsing with regex-based extraction
  - Progress metadata including stage, ETA, speed, and passwords tested
  - Smart throttling: DB writes every 5s, WebSocket broadcasts every 1.5s
  - Stage-based tracking (validation → preparation → cracking → parsing → completed)

- **Enhanced Frontend Progress Display**:
  - Real-time speed metrics (H/s, kH/s, MH/s, GH/s)
  - Estimated time remaining with auto-formatting
  - Dictionary progress (current/total passwords tested)
  - Current action and stage indicators
  - Success/error state visualization

- **PCAP Processing Improvements**:
  - Moved to background queue for async processing
  - File size pre-check (1GB limit) to prevent memory exhaustion
  - Returns 202 Accepted immediately on upload

- **Dictionary Management Enhancements**:
  - Memory-efficient word counting using streaming (prevents OOM on large files)
  - Support for 500MB+ dictionary files without crashes

### Added - Infrastructure
- **Docker Production Support**:
  - Production-ready Dockerfiles for web (Next.js) and API (Hono)
  - Multi-stage builds for optimized image sizes
  - Health checks for all services
  - Proper logging configuration
  - docker-compose.prod.yml for full stack deployment

- **Comprehensive Documentation**:
  - DEPLOYMENT.md with complete deployment guide
  - Production environment configuration examples
  - Backup and recovery procedures
  - Security best practices
  - Troubleshooting guide

- **Testing Infrastructure**:
  - Basic E2E tests with Playwright
  - Smoke tests for critical paths
  - API test suite (94% pass rate)
  - Test database isolation

### Changed
- **Build System**: Switched from tsc to tsx for API builds
  - Workaround for Hono type inference memory issues
  - Faster builds with esbuild
  - Runtime type checking with Zod

- **Next.js Configuration**: Enabled standalone output for Docker builds

- **Service Names**: Updated from 'autopwn' to 'crackhouse' branding

### Fixed
- Health endpoint tests now expect correct service name
- Database schema synchronization between development and test environments
- Migration application process for test databases

### Performance
- Reduced database write load by ~70% through smart progress throttling
- Streaming file processing for large dictionaries
- Optimized Docker build contexts with .dockerignore files

### Security
- Proper file size validation before processing
- Memory exhaustion prevention on large file uploads
- Non-root Docker users for all services
- Health checks for service monitoring

### Database
- Added `progressMetadata` JSONB column to jobs table (migration 0006)
- GIN index on progress_metadata for efficient querying
- Support for detailed job progress tracking

### Known Issues
- 13 dictionary route tests failing (documented in KNOWN_ISSUES.md)
- E2E tests need enhanced auth helpers and database cleanup
- TypeScript full compilation disabled due to Hono type inference issues

### Documentation
- Added comprehensive README.md
- Created DEPLOYMENT.md for production deployment
- Added .env.production.example with all required variables
- Documented known issues in KNOWN_ISSUES.md

### Dependencies
- Node.js 25
- Next.js 16.1.1
- Hono 4.11.3
- PostgreSQL 16
- Redis 7
- Drizzle ORM 0.44.6
- Better Auth 1.4.10

## [Unreleased]

### Planned for v1.1
- GPU acceleration support for hashcat
- Email notifications for job completion
- Advanced analytics dashboard
- Docker images on DockerHub
- Scheduled job execution

### Planned for v1.2
- Team collaboration features
- Role-based access control (RBAC)
- Audit logging
- Export job results
- Batch job creation

---

[1.0.0]: https://github.com/yourusername/crackhouse/releases/tag/v1.0.0
