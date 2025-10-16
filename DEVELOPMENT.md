# Development Guide

This guide helps developers set up and work with the AutoPWN codebase.

## 📝 Logging Standards

**Rule**: All logging must use the centralized logger system. Direct `console.*` statements are prohibited in application code.

### Using the Logger

```typescript
import { logError, logWarn, logInfo, logDebug, logApi, logData } from '@/lib/logger';

// Error logging (critical issues)
logError('Database connection failed:', error);

// Warning logging (recoverable issues)
logWarn('Deprecated API endpoint used', { endpoint: '/old-api' });

// Info logging (general information)
logInfo('User logged in successfully');

// Debug logging (development details)
logDebug('Processing request with data:', requestData);

// API logging (API calls and responses)
logApi('POST /api/users', { userId: '123' });

// Data logging (verbose data dumps)
logData('Complete response data:', apiResponse);
```

### Log Levels

- **ERROR**: Critical errors, system failures
- **WARN**: Warning messages, deprecated features
- **INFO**: General application flow information
- **DEBUG**: Detailed debugging information
- **VERBOSE**: Everything including data dumps

### Environment Configuration

```bash
# Development (default)
LOG_LEVEL=DEBUG

# Production
LOG_LEVEL=INFO

# Minimal logging
LOG_LEVEL=ERROR
```

## 🔧 Finding Console Statements

The ESLint configuration enforces logging standards:

**Error level** (must use logger):
- `src/app/api/**/*.ts` - API routes
- `src/lib/**/*.ts` - Core library files
- `src/middleware.ts` - Middleware

**Warning level** (console allowed but discouraged):
- `src/app/**/*.tsx` - React components
- `src/components/**/*.tsx` - React components
- `src/hooks/**/*.ts` - Custom hooks
- `src/tools/**/*` - External tool integrations
- `src/utils/**/*` - Utility functions

**Allowed** (console statements permitted):
- `src/lib/logger.ts` - Logger implementation
- `src/tests/**/*` - Test files
- `scripts/**/*` - Build scripts

To check for console statements:

```bash
# Show all console warnings and errors
pnpm lint

# Show only console errors in core application code
pnpm lint src/app/api src/lib src/middleware.ts

# Count remaining console statements
pnpm lint 2>&1 | grep -c "no-console"
```

## 🐳 Docker Development

### Building Specific Variants

```bash
# CPU variant
docker build -f docker/Dockerfile.cpu -t autopwn:cpu .

# NVIDIA GPU variant
docker build -f docker/Dockerfile.nvidia -t autopwn:nvidia .

# AMD GPU variant
docker build -f docker/Dockerfile.amd -t autopwn:amd .

# Intel GPU variant
docker build -f docker/Dockerfile.intel -t autopwn:intel .
```

### Running Specific Variants

```bash
# CPU
docker-compose -f docker-compose.cpu.yml up -d

# NVIDIA GPU
docker-compose -f docker-compose.nvidia.yml up -d

# AMD GPU
docker-compose -f docker-compose.amd.yml up -d

# Intel GPU
docker-compose -f docker-compose.intel.yml up -d
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:run

# Linting
pnpm lint

# Type checking
pnpm tsc

# Format code
pnpm format:write
```

## 📝 Code Style

### ESLint Rules

- No console statements in application code
- TypeScript strict mode enabled
- Proper error handling required
- No unused variables

### Import Organization

```typescript
// External libraries
import { NextRequest, NextResponse } from 'next/server';

// Internal modules
import { db } from '@/lib/db';
import { logError } from '@/lib/logger';

// Local modules
import { helperFunction } from './utils';
```

## 🏗️ Development Workflow

1. **Setup**: Clone repository and install dependencies
2. **Environment**: Copy `.env.example` to `.env.local` and configure
3. **Database**: Run migrations with `pnpm db:generate && pnpm db:migrate`
4. **Development**: Start dev server with `pnpm dev`
5. **Testing**: Run tests before committing
6. **Linting**: Fix all lint errors before PR

## 📁 Project Structure

```
src/
├── app/               # Next.js app pages and API routes
├── lib/               # Shared utilities and configurations
│   ├── logger.ts      # Centralized logging system
│   └── db/           # Database schema and configuration
├── tools/             # External tool integrations
└── tests/             # Test files
```

## 🚀 Common Development Tasks

### Adding New API Endpoint

1. Create route file in `src/app/api/`
2. Import logger functions: `import { logError } from '@/lib/logger'`
3. Use structured error handling
4. Add appropriate logging at different levels

### Database Changes

1. Modify schema in `src/lib/db/schema.ts`
2. Generate migrations: `pnpm db:generate`
3. Apply migrations: `pnpm db:migrate`
4. Test with `pnpm db:studio`

### Adding New External Tools

1. Create tool integration in `src/tools/`
2. Add validation in `src/lib/tool-validation.ts`
3. Use logger for all status messages
4. Test tool availability and functionality