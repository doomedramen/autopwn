# Development Guide

Contributing to crackhouse and local development setup.

## Table of Contents
- [Critical: Runtime Configuration Philosophy](#critical-runtime-configuration-philosophy)
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Critical: Runtime Configuration Philosophy

**⚠️ IMPORTANT: crackhouse must be deployable via Docker Compose without building.**

### Core Principle

**ALL backend configuration MUST be provided via environment variables at runtime.** This is non-negotiable.

### Why This Matters

End users should be able to:
```bash
# 1. Pull pre-built images
docker pull ghcr.io/doomedramen/crackhouse-backend:latest

# 2. Create docker-compose.yml and .env file
cp .env.example .env
nano .env  # Edit configuration

# 3. Start application
docker compose up -d

# NO BUILDING REQUIRED!
```

### Developer Rules

**✅ ALWAYS:**
- Read configuration from `process.env`
- Provide sensible defaults for optional settings
- Validate required environment variables on startup
- Document all environment variables in `.env.example`

**❌ NEVER:**
- Hardcode configuration values
- Use config files that can't be overridden by env vars
- Require users to rebuild Docker images to change settings
- Bake secrets or user-specific config into Docker images

### Example: Correct Configuration Pattern

```typescript
// src/config/index.ts
export const config = {
  // Required - fail fast if missing
  database: {
    url: process.env.DATABASE_URL!,
  },
  session: {
    secret: process.env.SESSION_SECRET!,
  },

  // Optional - with defaults
  hashcat: {
    maxConcurrentJobs: parseInt(process.env.HASHCAT_MAX_CONCURRENT_JOBS || '2'),
    defaultWorkload: parseInt(process.env.HASHCAT_DEFAULT_WORKLOAD || '3'),
    jobTimeout: parseInt(process.env.HASHCAT_JOB_TIMEOUT || '86400'),
  },

  // Feature flags
  features: {
    bullBoardEnabled: process.env.BULL_BOARD_ENABLED === 'true',
  },
};

// Validate on startup
export function validateConfig() {
  const required = ['DATABASE_URL', 'REDIS_URL', 'SESSION_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('Please check your .env file or docker-compose.yml');
    process.exit(1);
  }

  console.log('✅ Configuration validated successfully');
}
```

### What Goes Where

**Runtime Config (environment variables):**
- Database URLs, credentials
- Redis connection strings
- API keys and secrets
- File size limits
- Concurrency settings
- Feature toggles
- Logging levels

**Build-time Only (baked into image):**
- Node.js version
- System packages (hashcat, hcxtools)
- npm dependencies
- Application code
- Static assets

### Testing Your Code

Before submitting a PR, test that configuration works at runtime:

```bash
# Build once
docker build -t test-backend -f docker/backend.Dockerfile .

# Test with different configs (no rebuild!)
docker run -e HASHCAT_MAX_CONCURRENT_JOBS=1 test-backend
docker run -e HASHCAT_MAX_CONCURRENT_JOBS=10 test-backend
docker run -e LOG_LEVEL=debug test-backend

# Should work without rebuilding!
```

**See [DEPLOYMENT.md](./DEPLOYMENT.md#critical-runtime-configuration) for complete guidelines.**

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
git clone https://github.com/yourusername/crackhouse.git
cd crackhouse
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
    container_name: crackhouse-dev-db
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=crackhouse_dev
      - POSTGRES_USER=crackhouse
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - dev_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crackhouse -d crackhouse_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: crackhouse-dev-redis
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
    container_name: crackhouse-dev-pgadmin
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@crackhouse.local
      - PGADMIN_DEFAULT_PASSWORD=admin
    volumes:
      - dev_pgadmin_data:/var/lib/pgadmin

  # Optional: Redis admin interface
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: crackhouse-dev-redis-ui
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
DATABASE_URL=postgresql://crackhouse:dev_password@localhost:5432/crackhouse_dev
REDIS_URL=redis://localhost:6379
SESSION_SECRET=development_secret_do_not_use_in_production
FRONTEND_URL=http://localhost:3000
BACKEND_PORT=4000

# Development-friendly settings
LOG_LEVEL=debug
PRETTY_LOGS=true
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
crackhouse/
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

Browse [GitHub Issues](https://github.com/yourusername/crackhouse/issues) and comment to claim one.

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

### Next.js Best Practices

**CRITICAL: Following Next.js best practices is essential for performance, SEO, and maintainability.**

#### App Router Structure

**Use route groups for organization:**
```
app/
├── (auth)/              # Auth pages (no /auth in URL)
│   ├── login/
│   └── layout.tsx
├── (dashboard)/         # Dashboard pages (no /dashboard in URL)
│   ├── captures/
│   ├── jobs/
│   └── layout.tsx
└── admin/              # Admin pages (/admin in URL)
    ├── users/
    └── layout.tsx
```

**Leverage layouts for shared UI:**
```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

#### Server vs Client Components

**Default to Server Components:**
```typescript
// app/captures/page.tsx (Server Component by default)
import { getCapturesForUser } from '@/lib/api';

export default async function CapturesPage() {
  const captures = await getCapturesForUser(); // Fetch on server

  return <CaptureList captures={captures} />;
}
```

**Use 'use client' only when necessary:**
```typescript
// components/capture-upload.tsx (needs interactivity)
'use client';

import { useState } from 'react';

export function CaptureUpload() {
  const [file, setFile] = useState<File | null>(null);
  // Interactive component requires client-side
  return <form>...</form>;
}
```

**When to use 'use client':**
- Event handlers (onClick, onChange, etc.)
- State management (useState, useReducer)
- Effects (useEffect, useLayoutEffect)
- Browser-only APIs (localStorage, window, etc.)
- Custom hooks that use client features

**When to avoid 'use client':**
- Data fetching (use Server Components)
- Static content rendering
- SEO-critical pages
- Heavy computations (do on server)

#### Data Fetching Best Practices

**Fetch data on the server:**
```typescript
// Good - Server Component
export default async function JobsPage() {
  const jobs = await fetch('http://localhost:4000/api/v1/jobs', {
    cache: 'no-store', // Dynamic data
  }).then(res => res.json());

  return <JobList jobs={jobs} />;
}

// Avoid - Client-side fetching for initial render
'use client';
export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    fetch('/api/jobs').then(res => res.json()).then(setJobs);
  }, []);
  return <JobList jobs={jobs} />;
}
```

**Use proper caching strategies:**
```typescript
// Static data (revalidate periodically)
const dictionaries = await fetch('http://localhost:4000/api/v1/dictionaries', {
  next: { revalidate: 3600 }, // Revalidate every hour
});

// Dynamic data (always fresh)
const jobs = await fetch('http://localhost:4000/api/v1/jobs', {
  cache: 'no-store',
});

// Static data (never revalidate until redeploy)
const config = await fetch('http://localhost:4000/api/v1/config', {
  cache: 'force-cache',
});
```

#### Loading and Error States

**Use loading.tsx for loading states:**
```typescript
// app/captures/loading.tsx
export default function Loading() {
  return <CaptureListSkeleton />;
}
```

**Use error.tsx for error boundaries:**
```typescript
// app/captures/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

#### Metadata and SEO

**Use generateMetadata for dynamic metadata:**
```typescript
// app/captures/[id]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const capture = await fetchCapture(params.id);

  return {
    title: `${capture.filename} - crackhouse`,
    description: `View capture details for ${capture.filename}`,
  };
}
```

**Set static metadata in layouts:**
```typescript
// app/layout.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | crackhouse',
    default: 'crackhouse - WiFi Handshake Cracking',
  },
  description: 'Automate WiFi handshake cracking with crackhouse',
};
```

#### Image Optimization

**Always use next/image:**
```typescript
import Image from 'next/image';

// Good
<Image
  src="/logo.png"
  alt="crackhouse logo"
  width={200}
  height={50}
  priority // For above-the-fold images
/>

// Avoid
<img src="/logo.png" alt="crackhouse logo" />
```

#### Font Optimization

**Use next/font:**
```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

#### Route Handlers (API Routes)

**Use Route Handlers sparingly:**
```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Forward to backend
  const response = await fetch('http://localhost:4000/api/v1/captures/upload', {
    method: 'POST',
    body: formData,
  });

  return NextResponse.json(await response.json());
}
```

**Prefer Server Actions for mutations:**
```typescript
// app/actions/capture.ts
'use server';

export async function uploadCapture(formData: FormData) {
  const response = await fetch('http://localhost:4000/api/v1/captures/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

// Component
'use client';
import { uploadCapture } from '@/app/actions/capture';

export function UploadForm() {
  return (
    <form action={uploadCapture}>
      <input type="file" name="file" />
      <button type="submit">Upload</button>
    </form>
  );
}
```

#### Performance Best Practices

**Code splitting with dynamic imports:**
```typescript
import dynamic from 'next/dynamic';

// Lazy load heavy components
const JobMonitor = dynamic(() => import('@/components/job-monitor'), {
  loading: () => <Skeleton />,
  ssr: false, // Only render on client if needed
});
```

**Optimize bundle size:**
```typescript
// Good - Import only what you need
import { format } from 'date-fns';

// Avoid - Imports entire library
import * as dateFns from 'date-fns';
```

**Use Suspense boundaries:**
```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>Jobs</h1>
      <Suspense fallback={<JobListSkeleton />}>
        <JobList />
      </Suspense>
    </div>
  );
}
```

#### Preferred Page Structure Pattern

**IMPORTANT: Use the page.tsx + content.tsx pattern for optimal server/client separation.**

This pattern takes full advantage of Next.js Server and Client Components:

**File Structure:**
```
app/
├── captures/
│   ├── page.tsx           # Server Component - SSR data fetching
│   ├── content.tsx         # Client Component - interactivity
│   └── loading.tsx         # Loading state
├── jobs/
│   ├── page.tsx           # Server Component
│   ├── content.tsx         # Client Component
│   └── loading.tsx
└── dictionaries/
    ├── page.tsx           # Server Component
    ├── content.tsx         # Client Component
    └── loading.tsx
```

**page.tsx (Server Component):**
```typescript
// app/captures/page.tsx
import { CapturesContent } from './content';
import { getCaptures } from '@/lib/api';

export default async function CapturesPage() {
  // Fetch data on server (SSR)
  const initialCaptures = await getCaptures();

  // Pass data to client component
  return <CapturesContent initialData={initialCaptures} />;
}
```

**content.tsx (Client Component):**
```typescript
// app/captures/content.tsx
'use client';

import { useState } from 'react';
import { Capture } from '@crackhouse/shared';
import { CaptureList } from '@/components/captures/capture-list';
import { UploadDialog } from '@/components/captures/upload-dialog';

interface CapturesContentProps {
  initialData: Capture[];
}

export function CapturesContent({ initialData }: CapturesContentProps) {
  const [captures, setCaptures] = useState(initialData);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleUploadSuccess = (newCapture: Capture) => {
    setCaptures([newCapture, ...captures]);
    setIsUploadOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Captures</h1>
        <button onClick={() => setIsUploadOpen(true)}>
          Upload PCAP
        </button>
      </div>

      <CaptureList captures={captures} />

      <UploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
```

**Why This Pattern?**

1. **✅ Optimal Performance:**
   - Server Component handles data fetching (no client-side waterfall)
   - Initial HTML includes data (faster First Contentful Paint)
   - Smaller JavaScript bundle (Server Component code not shipped)

2. **✅ Clear Separation:**
   - `page.tsx` = Data fetching, SSR, SEO
   - `content.tsx` = Interactivity, state, events
   - Easy to understand at a glance

3. **✅ Better SEO:**
   - Initial data rendered on server
   - Search engines see full content
   - Metadata can use actual data

4. **✅ Progressive Enhancement:**
   - Page works with JavaScript disabled (shows initial data)
   - Interactivity enhances the experience
   - Graceful degradation

5. **✅ Type Safety:**
   - Props clearly define data contract
   - TypeScript ensures consistency
   - Easy to refactor

**Example: Jobs Page with Dynamic Data**

```typescript
// app/jobs/page.tsx
import { JobsContent } from './content';
import { getJobs, getNetworks, getDictionaries } from '@/lib/api';

export default async function JobsPage() {
  // Fetch all required data in parallel on server
  const [jobs, networks, dictionaries] = await Promise.all([
    getJobs(),
    getNetworks(),
    getDictionaries(),
  ]);

  return (
    <JobsContent
      initialJobs={jobs}
      networks={networks}
      dictionaries={dictionaries}
    />
  );
}
```

```typescript
// app/jobs/content.tsx
'use client';

import { useState, useEffect } from 'react';
import { Job, Network, Dictionary } from '@crackhouse/shared';
import { JobList } from '@/components/jobs/job-list';
import { CreateJobDialog } from '@/components/jobs/create-job-dialog';

interface JobsContentProps {
  initialJobs: Job[];
  networks: Network[];
  dictionaries: Dictionary[];
}

export function JobsContent({
  initialJobs,
  networks,
  dictionaries,
}: JobsContentProps) {
  const [jobs, setJobs] = useState(initialJobs);

  // Poll for job updates (client-side only)
  useEffect(() => {
    const interval = setInterval(async () => {
      const updated = await fetch('/api/jobs').then(r => r.json());
      setJobs(updated.data);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <JobList jobs={jobs} />
      <CreateJobDialog networks={networks} dictionaries={dictionaries} />
    </div>
  );
}
```

**When to Deviate from This Pattern:**

- ❌ **Don't use for static pages** (about, docs, etc.) - just use Server Component
- ❌ **Don't use if no interactivity needed** - Server Component is sufficient
- ✅ **Do use for dashboard pages** with data + interactions
- ✅ **Do use for list pages** with filtering, sorting, actions
- ✅ **Do use for form-heavy pages** with real-time updates

**Benefits Summary:**

| Aspect | Traditional SPA | Server Component Only | page.tsx + content.tsx |
|--------|----------------|----------------------|------------------------|
| Initial Load | ❌ Slow | ✅ Fast | ✅ Fast |
| Interactivity | ✅ Full | ❌ Limited | ✅ Full |
| SEO | ❌ Poor | ✅ Excellent | ✅ Excellent |
| Bundle Size | ❌ Large | ✅ Small | ✅ Optimized |
| Maintainability | ⚠️ Medium | ✅ Good | ✅ Excellent |

**This pattern is preferred for all interactive pages in crackhouse.**

#### Common Pitfalls to Avoid

**❌ Don't fetch data in client components for initial render:**
```typescript
// Bad
'use client';
export default function Page() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/data').then(res => res.json()).then(setData);
  }, []);
}

// Good - Use Server Component
export default async function Page() {
  const data = await fetch('/api/data').then(res => res.json());
  return <DataList data={data} />;
}
```

**❌ Don't use 'use client' at the top level unnecessarily:**
```typescript
// Bad - Makes entire page tree client-side
'use client';
export default function Layout({ children }) {
  return <div>{children}</div>;
}

// Good - Keep layouts as Server Components
export default function Layout({ children }) {
  return <div>{children}</div>;
}
```

**❌ Don't import server-only code in client components:**
```typescript
// Bad - Database code in client component
'use client';
import { db } from '@/lib/db'; // Error!

// Good - Separate server and client concerns
// Server Component handles data, passes to Client Component
```

**❌ Don't use useEffect for data fetching on initial load:**
```typescript
// Bad
useEffect(() => {
  fetchData().then(setData);
}, []);

// Good - Use Server Component or React Query for client-side
```

#### Environment Variables

**Use NEXT_PUBLIC_ prefix for client-side variables:**
```bash
# .env
NEXT_PUBLIC_API_URL=http://localhost:4000  # Available in browser
DATABASE_URL=postgresql://...              # Server-only
```

```typescript
// Client Component
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Works

// Server Component
const dbUrl = process.env.DATABASE_URL; // Works
```

#### Why These Practices Matter

1. **Performance**: Server Components reduce JavaScript bundle size
2. **SEO**: Server-side rendering improves search engine visibility
3. **User Experience**: Faster initial page loads and better perceived performance
4. **Maintainability**: Clear separation of client/server concerns
5. **Security**: Sensitive code stays on the server
6. **Scalability**: Better caching and reduced server load

**📖 Resources:**
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching Patterns](https://nextjs.org/docs/app/building-your-application/data-fetching)

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
psql postgresql://crackhouse:dev_password@localhost:5432/crackhouse_dev

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
