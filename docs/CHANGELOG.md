# Changelog

All notable changes to the AutoPWN project.

## [Unreleased] - 2025-10-24

### Added

#### Security Enhancements
- **File Path Validation**: Comprehensive path validation and sanitization in hashcat worker
  - Prevents path traversal attacks
  - Command injection protection
  - Extension whitelisting
  - Symlink protection
  - See: `apps/api/src/lib/file-path-validator.ts`

- **Session IP Validation**: Added session IP validation to prevent session hijacking
  - Tracks session IP addresses
  - Validates IP on each request
  - Configurable in Better Auth

#### Infrastructure
- **Redis-Backed Rate Limiting**: Replaced in-memory rate limiting with Redis
  - Supports horizontal scaling
  - Automatic fallback to in-memory for testing
  - Adds `X-RateLimit-Backend` header
  - See: `apps/api/src/middleware/rateLimit.ts`

- **Email Verification**: Enabled Better Auth email verification
  - Production-only requirement
  - Nodemailer integration
  - HTML email templates
  - See: `docs/EMAIL_VERIFICATION.md`

#### Testing
- **Test Coverage Configuration**: Added comprehensive coverage thresholds
  - 80% lines, 80% functions, 75% branches, 80% statements
  - Per-file coverage tracking
  - Watermark visualization
  - See: `docs/TEST_COVERAGE.md`

- **Fixed HCX Tools Tests**: Resolved 15 failing tests
  - Added proper mock configurations
  - All conversion tests passing

- **Fixed Security Middleware Tests**: Resolved 4 failing tests
  - Updated mock context structure
  - Proper Hono Headers API mocking

#### Docker & Deployment
- **Optimized Docker Environments**:
  - **Testing**: tmpfs storage, parallel execution, caching
  - **Development**: Mailhog, environment variables, resource limits
  - **Production**: Security hardening, resource limits, health checks

- **Docker Documentation**:
  - `docs/DOCKER_DEPLOYMENT.md`: 500+ line comprehensive deployment guide
  - `docs/DOCKER_FILES_OVERVIEW.md`: Docker Compose files explained
  - `docs/REDIS_CONFIGURATION.md`: Redis security and performance guide

- **Production Redis Configuration**: Created `config/redis-prod.conf`
  - Security hardening (dangerous commands disabled)
  - Performance optimization (I/O threading, active defragmentation)
  - Persistence configuration (RDB + AOF)

- **Database Init Script Improvements**: Enhanced `scripts/init-db.sql`
  - Comprehensive documentation
  - pg_stat_statements handling explained
  - Error handling for GRANT statements
  - Production configuration guidance

### Changed

#### Configuration
- **Redis Password Handling**: Made REDIS_PASSWORD optional with warnings
  - Conditional shell logic in docker-compose.prod.yml
  - Clear warning messages when password not set
  - Documentation on security implications

- **CI Docker Compose**: Fixed test-runner command
  - Removed Docker-in-Docker dependency
  - Runs unit and integration tests directly
  - Faster, more reliable CI execution

#### Documentation
- **Organized Documentation Structure**:
  - Created `docs/README.md` with complete index
  - Archived outdated review documents
  - Added documentation section to main README
  - Cross-referenced related docs

- **Removed Deprecated Fields**:
  - Removed `version` field from docker-compose files (deprecated in Docker Compose v2)

### Fixed

#### Docker
- **Production Redis Password**: Fixed config validation error
  - Made password optional for validation
  - Added conditional password protection
  - Enhanced health checks

- **Database Init Script**: Fixed initialization errors
  - Removed pg_stat_statements config (requires server restart)
  - Fixed GRANT statements to use current_database()
  - Added error handling

#### Testing
- **Mock Configurations**: Fixed test failures
  - HCX tools: Added mockHCXTools declarations
  - Security middleware: Fixed mock context structure
  - All tests now passing

### Documentation

- **New Documentation Files**:
  - `docs/DOCKER_DEPLOYMENT.md` - Complete Docker deployment guide
  - `docs/DOCKER_FILES_OVERVIEW.md` - Docker Compose files overview
  - `docs/REDIS_CONFIGURATION.md` - Redis configuration and security
  - `docs/EMAIL_VERIFICATION.md` - Email verification setup
  - `docs/TEST_COVERAGE.md` - Test coverage guide
  - `docs/README.md` - Documentation index

- **Updated Documentation**:
  - Enhanced database init script comments
  - Improved production deployment checklist
  - Added Redis password security section
  - Updated main README with documentation links

### Infrastructure

#### Code Quality
- Comprehensive file path validation throughout
- Improved error handling in workers
- Better logging with context

#### Configuration
- Environment variable validation
- Sensible defaults for all Docker environments
- Clear security warnings for production

### Deprecated

- Docker Compose `version` field (removed - no longer needed in v2)

### Security

- ✅ Path traversal protection
- ✅ Command injection prevention
- ✅ Redis password protection (with warnings)
- ✅ Session IP validation
- ✅ File extension whitelisting
- ✅ Symlink protection
- ✅ Read-only Docker containers
- ✅ No-new-privileges security opt
- ✅ Resource limits on all services

## Previous Changes

See `docs/archive/` for historical review and planning documents.

---

**Last Updated:** 2025-10-24
