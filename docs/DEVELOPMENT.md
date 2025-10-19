# Development Guide

Contributing to autopwn and local development setup.

## Table of Contents
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

**Required:**
- Node.js 20+ and npm/pnpm
- Docker and Docker Compose
- Git

**Optional but recommended:**
- VS Code with recommended extensions
- PostgreSQL client (for direct DB access)
- Redis CLI

### Initial Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/autopwn.git
cd autopwn
```

2. **Install dependencies:**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Or use pnpm
pnpm install
```

3. **Start development services:**
```bash
# From project root
docker compose -f docker-compose.dev.yml up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
```

4. **Set up environment:**
```bash
# Backend
cd backend
cp .env.example .env.development

# Frontend
cd ../frontend
cp .env.example .env.development
```

5. **Run database migrations:**
```bash
cd backend
npm run db:migrate
npm run db:seed  # Optional: seed test data
```

6. **Start development servers:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Worker
cd backend
npm run worker:dev
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Bull Board: http://localhost:4000/admin/queues

## Development Environment

### docker-compose.dev.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: autopwn-dev-db
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=autopwn_dev
      - POSTGRES_USER=autopwn
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - dev_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U autopwn -d autopwn_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: autopwn-dev-redis
    ports:
      - "6379:6379"
    volumes:
      - dev_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Database admin interface
  pgadmin:
    image: dpage/pgadmin4
    container_name: autopwn-dev-pgadmin
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@autopwn.local
      - PGADMIN_DEFAULT_PASSWORD=admin
    volumes:
      - dev_pgadmin_data:/var/lib/pgadmin

  # Optional: Redis admin interface
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: autopwn-dev-redis-ui
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379

volumes:
  dev_postgres_data:
  dev_redis_data:
  dev_pgadmin_data:
```

### VS Code Configuration

**.vscode/settings.json:**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true
  }
}
```

**.vscode/extensions.json:**
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-azuretools.vscode-docker"
  ]
}
```

### Environment Variables (Development)

**backend/.env.development:**
```bash
NODE_ENV=development
DATABASE_URL=postgresql://autopwn:dev_password@localhost:5432/autopwn_dev
REDIS_URL=redis://localhost:6379
SESSION_SECRET=development_secret_do_not_use_in_production
FRONTEND_URL=http://localhost:3000
BACKEND_PORT=4000

# Development-friendly settings
LOG_LEVEL=debug
PRETTY_LOGS=true
RATE_LIMIT_ENABLED=false
BULL_BOARD_ENABLED=true

# File paths (local development)
UPLOAD_DIR=./dev_data/uploads
PROCESSED_DIR=./dev_data/processed
GENERATED_DIR=./dev_data/generated
HASHCAT_DIR=./dev_data/hashcat
LOG_DIR=./dev_data/logs

# Smaller limits for testing
MAX_PCAP_SIZE=52428800  # 50MB
MAX_DICTIONARY_SIZE=1073741824  # 1GB

# Quick jobs for testing
HASHCAT_MAX_CONCURRENT_JOBS=1
HASHCAT_JOB_TIMEOUT=600  # 10 minutes
```

**frontend/.env.development:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Project Structure

```
autopwn/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/             # App router pages
│   │   │   ├── (auth)/      # Auth group
│   │   │   ├── (dashboard)/ # Dashboard group
│   │   │   ├── admin/       # Admin pages
│   │   │   └── api/         # API routes (if any)
│   │   ├── components/      # React components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── captures/
│   │   │   ├── jobs/
│   │   │   └── shared/
│   │   ├── lib/             # Utilities
│   │   │   ├── api.ts       # API client
│   │   │   ├── auth.ts      # Better Auth client
│   │   │   └── utils.ts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript types
│   │   └── styles/          # Global styles
│   ├── public/              # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── backend/                  # Fastify backend
│   ├── src/
│   │   ├── routes/          # API routes
│   │   │   ├── auth.ts
│   │   │   ├── captures.ts
│   │   │   ├── networks.ts
│   │   │   ├── dictionaries.ts
│   │   │   ├── jobs.ts
│   │   │   └── index.ts
│   │   ├── services/        # Business logic
│   │   │   ├── auth.service.ts
│   │   │   ├── capture.service.ts
│   │   │   ├── dictionary.service.ts
│   │   │   └── job.service.ts
│   │   ├── workers/         # BullMQ workers
│   │   │   ├── conversion.worker.ts
│   │   │   ├── generation.worker.ts
│   │   │   └── hashcat.worker.ts
│   │   ├── db/              # Database
│   │   │   ├── schema/      # Drizzle schema
│   │   │   ├── migrations/  # Migration files
│   │   │   └── index.ts
│   │   ├── lib/             # Utilities
│   │   │   ├── hashcat.ts
│   │   │   ├── hcxtools.ts
│   │   │   ├── crunch.ts
│   │   │   └── validation.ts
│   │   ├── middleware/      # Fastify middleware
│   │   │   ├── auth.ts
│   │   │   ├── rbac.ts
│   │   │   └── error.ts
│   │   ├── types/           # TypeScript types
│   │   ├── config/          # Configuration
│   │   ├── app.ts           # Fastify app setup
│   │   ├── server.ts        # HTTP server
│   │   └── worker.ts        # Worker process
│   ├── test/                # Tests
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── SETUP.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md
│   └── ROADMAP.md
│
├── docker/                   # Docker files
│   ├── frontend.Dockerfile
│   ├── backend.Dockerfile
│   └── worker.Dockerfile
│
├── docker-compose.yml        # Development compose
├── docker-compose.prod.yml   # Production compose
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

## Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **UI Library:** React 18+
- **Styling:** TailwindCSS
- **Components:** shadcn/ui
- **State Management:** React Context + hooks
- **Forms:** React Hook Form + Zod
- **Auth:** Better Auth client

### Backend
- **Framework:** Fastify 4+
- **Language:** TypeScript
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL 16
- **Queue:** BullMQ + Redis
- **Auth:** Better Auth
- **Validation:** Zod

### DevOps
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** nginx or Traefik
- **CI/CD:** GitHub Actions (TBD)

## Development Workflow

### 1. Pick an Issue

Browse [GitHub Issues](https://github.com/yourusername/autopwn/issues) and comment to claim one.

### 2. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### 3. Make Changes

Write code following our [code standards](#code-standards).

### 4. Test Your Changes

```bash
# Run linter
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Run all checks
npm run validate
```

### 5. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat: add dictionary generation with leet speak"
git commit -m "fix: resolve PCAP upload timeout issue"
git commit -m "docs: update API documentation for jobs endpoint"
```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Create a Pull Request on GitHub with:
- Clear title and description
- Reference related issues
- Screenshots (if UI changes)
- Test instructions

## Code Standards

### TypeScript

**Use strict mode:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

**Prefer interfaces over types:**
```typescript
// Good
interface User {
  id: string;
  email: string;
}

// Avoid (unless needed)
type User = {
  id: string;
  email: string;
}
```

**Use explicit return types:**
```typescript
// Good
function getUser(id: string): Promise<User> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

// Avoid
function getUser(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}
```

### React

**Use functional components:**
```typescript
// Good
export function CaptureList({ userId }: { userId: string }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  // ...
}

// Avoid class components
```

**Extract complex logic to hooks:**
```typescript
// hooks/useCaptures.ts
export function useCaptures(userId: string) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaptures(userId).then(setCaptures).finally(() => setLoading(false));
  }, [userId]);

  return { captures, loading };
}

// Component
export function CaptureList({ userId }: { userId: string }) {
  const { captures, loading } = useCaptures(userId);
  // ...
}
```

### Fastify

**Use async/await:**
```typescript
// Good
app.get('/captures/:id', async (request, reply) => {
  const capture = await captureService.findById(request.params.id);
  return reply.send({ data: capture });
});

// Avoid callbacks
```

**Validate input with Zod:**
```typescript
import { z } from 'zod';

const createJobSchema = z.object({
  name: z.string().min(1).max(255),
  networkIds: z.array(z.string().uuid()).min(1),
  dictionaryIds: z.array(z.string().uuid()).min(1),
});

app.post('/jobs', async (request, reply) => {
  const data = createJobSchema.parse(request.body);
  // ...
});
```

### Naming Conventions

- **Files:** kebab-case (`capture-service.ts`, `use-captures.ts`)
- **Components:** PascalCase (`CaptureList.tsx`, `JobCard.tsx`)
- **Functions/Variables:** camelCase (`getUserById`, `isLoading`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_FILE_SIZE`, `API_URL`)
- **Types/Interfaces:** PascalCase (`User`, `Capture`, `JobStatus`)

### Error Handling

**Backend:**
```typescript
import { AppError } from './lib/errors';

// Throw custom errors
if (!user) {
  throw new AppError('User not found', 404, 'USER_NOT_FOUND');
}

// Global error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected errors
  logger.error(error);
  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});
```

**Frontend:**
```typescript
try {
  await api.createJob(data);
  toast.success('Job created successfully');
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(error.message);
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

## Testing

### Backend Tests

**Unit tests (Vitest):**
```typescript
// capture.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CaptureService } from './capture.service';

describe('CaptureService', () => {
  let service: CaptureService;

  beforeEach(() => {
    service = new CaptureService();
  });

  it('should create a capture', async () => {
    const capture = await service.create({
      userId: 'user-id',
      filename: 'test.pcap',
      fileSize: 1024,
    });

    expect(capture.id).toBeDefined();
    expect(capture.status).toBe('pending');
  });
});
```

**Integration tests:**
```typescript
// captures.route.test.ts
import { describe, it, expect } from 'vitest';
import { build } from './app';

describe('POST /captures/upload', () => {
  it('should upload a PCAP file', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/captures/upload',
      headers: {
        'content-type': 'multipart/form-data',
      },
      payload: {
        file: Buffer.from('test'),
      },
    });

    expect(response.statusCode).toBe(201);
  });
});
```

**Run tests:**
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Frontend Tests

**Component tests (React Testing Library):**
```typescript
// CaptureList.test.tsx
import { render, screen } from '@testing-library/react';
import { CaptureList } from './CaptureList';

describe('CaptureList', () => {
  it('renders captures', () => {
    const captures = [
      { id: '1', filename: 'test.pcap', status: 'completed' },
    ];

    render(<CaptureList captures={captures} />);

    expect(screen.getByText('test.pcap')).toBeInTheDocument();
  });
});
```

**Run tests:**
```bash
npm run test
```

### E2E Tests (Future)

Playwright for end-to-end testing:

```typescript
import { test, expect } from '@playwright/test';

test('upload and crack workflow', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Login
  await page.fill('[name=email]', 'user@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // Upload PCAP
  await page.click('text=Upload Capture');
  await page.setInputFiles('input[type=file]', 'test.pcap');
  await page.click('text=Upload');

  // Wait for processing
  await expect(page.locator('text=Completed')).toBeVisible({ timeout: 30000 });
});
```

## Contributing

### Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] All tests pass (`npm run test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linter passes (`npm run lint`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow convention
- [ ] PR description is clear and complete
- [ ] No merge conflicts with main

### Code Review

PRs require at least one approval before merging.

**Review criteria:**
- Code quality and readability
- Test coverage
- Performance implications
- Security considerations
- Documentation completeness

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions builds and publishes Docker images

## Troubleshooting

### Database Issues

**Reset database:**
```bash
cd backend
npm run db:reset  # Drops, recreates, and migrates
npm run db:seed   # Optional: add test data
```

**View database:**
```bash
# Using psql
psql postgresql://autopwn:dev_password@localhost:5432/autopwn_dev

# Or use PgAdmin at http://localhost:5050
```

### Redis Issues

**Clear Redis:**
```bash
redis-cli FLUSHALL
```

**View queues:**
Visit http://localhost:4000/admin/queues

### Port Conflicts

**Kill process on port:**
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

### TypeScript Errors

**Clear and rebuild:**
```bash
rm -rf node_modules dist .next
npm install
npm run build
```

## Getting Help

- **Documentation:** Check `/docs` directory
- **GitHub Issues:** Search existing issues
- **Discussions:** Use GitHub Discussions for questions
- **Discord:** Join our community server (TBD)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
