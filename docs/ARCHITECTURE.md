# Architecture Overview

## System Design

autopwn is built as a microservices-oriented application with clear separation between frontend, backend, database, and worker services.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
│                                                               │
│  ┌──────────────┐         ┌─────────────────┐               │
│  │              │         │                 │               │
│  │   Next.js    │────────▶│    Fastify      │               │
│  │   Frontend   │   HTTP  │    Backend      │               │
│  │   (Port 3000)│         │   (Port 4000)   │               │
│  │              │         │                 │               │
│  └──────────────┘         └────────┬────────┘               │
│         │                          │                         │
│         │                          │                         │
│         │                 ┌────────┼────────┐               │
│         │                 │        │        │               │
│         │          ┌──────▼───┐ ┌─▼─────┐ ┌▼──────────┐   │
│         │          │PostgreSQL│ │ Redis │ │  BullMQ   │   │
│         │          │          │ │       │ │  Workers  │   │
│         │          │(Port 5432│ │(6379) │ │           │   │
│         │          └──────────┘ └───────┘ └─────┬─────┘   │
│         │                                         │         │
│         │                                         │         │
│         │                                  ┌──────▼──────┐  │
│         │                                  │             │  │
│         └─────────────────────────────────▶│ File System │  │
│                                             │   Volume    │  │
│                                             │(/data)      │  │
│                                             └─────────────┘  │
│                                                               │
│  External Tools (in backend/worker containers):              │
│  - hcxpcapngtool (PCAP → hc22000 conversion)                │
│  - hashcat (Password cracking)                               │
│  - crunch (Dictionary generation)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (Next.js)

**Technology Stack:**
- Next.js 14+ (App Router)
- React 18+
- TypeScript
- TailwindCSS
- shadcn/ui components
- Better Auth client

**Responsibilities:**
- User interface rendering
- Form validation
- File upload handling
- Real-time job status updates (polling/SSE)
- User authentication UI
- Dashboard and analytics

**Key Pages:**
- `/login` - Authentication
- `/dashboard` - Overview of captures, jobs, stats
- `/captures` - PCAP file management
- `/networks` - Extracted networks from captures
- `/dictionaries` - Wordlist management and generation
- `/jobs` - Hashcat job creation and monitoring
- `/results` - Cracked passwords and history
- `/admin` - User management (admin/superuser only)
- `/settings` - User preferences and configuration

### Backend (Fastify)

**Technology Stack:**
- Fastify 4+
- TypeScript
- Better Auth
- Drizzle ORM
- Zod (validation)
- BullMQ (job queue)

**Responsibilities:**
- RESTful API endpoints
- Authentication and authorization
- File upload processing
- Database operations
- Job queue management
- PCAP → hc22000 conversion
- Executing external tools
- Session management

**API Structure:**
```
/api/v1/
  ├── /auth
  │   ├── POST /login
  │   ├── POST /logout
  │   ├── GET /session
  │   └── POST /change-password
  ├── /users (admin only)
  │   ├── GET /
  │   ├── POST /
  │   ├── PATCH /:id
  │   └── DELETE /:id
  ├── /captures
  │   ├── GET /
  │   ├── POST /upload
  │   ├── GET /:id
  │   └── DELETE /:id
  ├── /networks
  │   ├── GET /
  │   ├── GET /:id
  │   └── GET /by-capture/:captureId
  ├── /dictionaries
  │   ├── GET /
  │   ├── POST /upload
  │   ├── POST /generate
  │   ├── GET /:id
  │   └── DELETE /:id
  ├── /jobs
  │   ├── GET /
  │   ├── POST /create
  │   ├── GET /:id
  │   ├── GET /:id/progress
  │   ├── POST /:id/cancel
  │   └── DELETE /:id
  ├── /results
  │   ├── GET /
  │   ├── GET /by-network/:networkId
  │   └── GET /by-job/:jobId
  └── /config (superuser only)
      ├── GET /
      └── PATCH /
```

### Database (PostgreSQL)

**Technology Stack:**
- PostgreSQL 16+
- Drizzle ORM

**Core Tables:**
- `users` - User accounts and roles
- `sessions` - Active user sessions
- `captures` - Uploaded PCAP files metadata
- `networks` - Extracted WiFi networks (SSID, BSSID, handshake type)
- `dictionaries` - Wordlist metadata
- `jobs` - Hashcat cracking jobs
- `job_networks` - Many-to-many: jobs ↔ networks
- `job_dictionaries` - Many-to-many: jobs ↔ dictionaries
- `results` - Cracked passwords
- `config` - System configuration (concurrent jobs, file limits, etc.)
- `audit_logs` - User actions and system events

See [DATABASE.md](./DATABASE.md) for detailed schema.

### Job Queue (BullMQ + Redis)

**Technology Stack:**
- Redis 7+
- BullMQ 5+

**Queue Types:**

1. **conversion-queue**: PCAP → hc22000 conversion
   - Input: Capture file path
   - Process: Run hcxpcapngtool
   - Output: hc22000 file, extracted networks
   - Priority: High
   - Concurrency: 3

2. **generation-queue**: Dictionary generation
   - Input: Keywords, options (case, leet, special chars)
   - Process: Run crunch with rules
   - Output: Generated wordlist file
   - Priority: Medium
   - Concurrency: 2

3. **hashcat-queue**: Password cracking jobs
   - Input: hc22000 files, dictionaries, attack mode
   - Process: Run hashcat
   - Output: Cracked passwords, potfile
   - Priority: Normal
   - Concurrency: Configurable by superuser (default: 2)
   - Timeout: Configurable (default: 24 hours)

**Job States:**
- `waiting` - Queued, not started
- `active` - Currently processing
- `completed` - Successfully finished
- `failed` - Error occurred
- `cancelled` - User cancelled

**Features:**
- Automatic retry on failure (configurable)
- Job progress tracking
- Job priority support
- Rate limiting
- Job logs and error tracking
- Bull Board dashboard for monitoring

### File Storage

**Structure:**
```
/data/
├── uploads/
│   ├── captures/          # Original .pcap files
│   │   └── {userId}/
│   │       └── {captureId}/
│   │           └── {filename}.pcap
│   └── dictionaries/      # Uploaded wordlists
│       └── {userId}/
│           └── {dictionaryId}/
│               └── {filename}.txt
├── processed/
│   └── hc22000/          # Converted handshake files
│       └── {captureId}/
│           └── {networkId}.hc22000
├── generated/
│   └── dictionaries/      # Generated wordlists
│       └── {dictionaryId}/
│           └── generated.txt
├── hashcat/
│   ├── potfiles/         # Hashcat pot files (results)
│   │   └── {jobId}.pot
│   └── sessions/         # Hashcat session files (for resume)
│       └── {jobId}.session
└── logs/
    ├── conversion/       # Conversion job logs
    ├── generation/       # Generation job logs
    └── hashcat/          # Hashcat job logs
```

**File Management:**
- User-based isolation
- Automatic cleanup of temp files
- File size limits (configurable)
- MIME type validation
- Virus scanning (future roadmap)

## Data Flow

### PCAP Upload and Conversion

```
1. User uploads .pcap file
   ↓
2. Frontend → POST /api/v1/captures/upload
   ↓
3. Backend validates file (size, type)
   ↓
4. Save to /data/uploads/captures/{userId}/{captureId}/
   ↓
5. Create database record (captures table)
   ↓
6. Add job to conversion-queue
   ↓
7. Worker picks up job
   ↓
8. Execute: hcxpcapngtool input.pcap -o output.hc22000
   ↓
9. Parse output, extract networks (SSID, BSSID)
   ↓
10. Save hc22000 files to /data/processed/hc22000/
    ↓
11. Create network records in database
    ↓
12. Mark job complete, update capture status
    ↓
13. Frontend polls for status, displays networks
```

### Dictionary Generation

```
1. User fills generation form (keywords, options)
   ↓
2. Frontend → POST /api/v1/dictionaries/generate
   ↓
3. Backend validates input
   ↓
4. Create database record (dictionaries table, status: generating)
   ↓
5. Add job to generation-queue
   ↓
6. Worker picks up job
   ↓
7. Execute: crunch + hashcat rules for variations
   ↓
8. Save to /data/generated/dictionaries/{dictionaryId}/
   ↓
9. Update database record (file size, line count, status: ready)
   ↓
10. Mark job complete
    ↓
11. Frontend shows dictionary ready for use
```

### Hashcat Job Execution

```
1. User creates job (selects networks + dictionaries)
   ↓
2. Frontend → POST /api/v1/jobs/create
   ↓
3. Backend validates selections
   ↓
4. Create job record in database
   ↓
5. Create junction records (job_networks, job_dictionaries)
   ↓
6. Add job to hashcat-queue
   ↓
7. Worker checks concurrent job limit
   ↓
8. Worker picks up job when slot available
   ↓
9. For each network in job:
   │  For each dictionary in job:
   │    Execute: hashcat -m 22000 network.hc22000 dictionary.txt
   │    Stream output for progress
   │    Check for cracked passwords in potfile
   ↓
10. Parse results, save to results table
    ↓
11. Save potfile to /data/hashcat/potfiles/
    ↓
12. Update job status (completed/failed)
    ↓
13. Frontend displays results
```

## Security Architecture

### Authentication Flow

```
1. User submits credentials
   ↓
2. Backend validates via Better Auth
   ↓
3. Password verified with bcrypt
   ↓
4. Session created in database + cookie
   ↓
5. Role and permissions loaded
   ↓
6. JWT or session token returned
   ↓
7. Frontend stores auth state
   ↓
8. All subsequent requests include auth token
   ↓
9. Backend middleware validates session
   ↓
10. RBAC checks for protected routes
```

### Authorization Levels

**Superuser:**
- Full system access
- User management (create/delete admins and users)
- System configuration
- View all data
- Cannot be deleted (at least one must exist)

**Admin:**
- User management (create/delete users only)
- View all data
- Manage all captures/jobs/dictionaries
- Cannot modify system configuration

**User:**
- Manage own captures, dictionaries, jobs
- View own results
- Cannot access other users' data
- Cannot access admin features

## Scalability Considerations

### Current Design (Single Node)
- All services run on one host via Docker Compose
- Suitable for personal/small team use
- CPU-bound by hashcat workload

### Future Scaling Options

**Horizontal Scaling:**
- Multiple worker containers for job processing
- Load balancer for backend API
- Shared Redis and PostgreSQL
- S3 for distributed file storage

**Vertical Scaling:**
- GPU support for hashcat (requires GPU-enabled containers)
- Increased worker concurrency
- More powerful CPU/RAM

**Job Distribution:**
- Kubernetes for orchestration
- Separate hashcat worker pool
- Job sharding across workers

## Technology Choices Rationale

**Why Fastify?**
- Fastest Node.js framework (important for API performance)
- Built-in schema validation
- Excellent TypeScript support
- Lower overhead than Express

**Why BullMQ?**
- Battle-tested for intensive workloads
- Excellent monitoring and retry logic
- Essential for hashcat's resource demands
- Built-in progress tracking
- Priority queues for job management

**Why PostgreSQL?**
- ACID compliance for job state
- Excellent JSON support (for job metadata)
- Strong ecosystem with Drizzle
- Better for complex queries than SQLite

**Why Better Auth?**
- Modern, TypeScript-first
- Works seamlessly with Next.js and Node.js
- Built-in session management
- RBAC support
- Active development

**Why Next.js?**
- Full-stack framework
- Excellent developer experience
- Built-in optimizations
- Server-side rendering for better UX
- API routes for simpler architecture (though we use separate backend)

## Monitoring and Observability

**Logs:**
- Application logs: stdout/stderr (captured by Docker)
- Job logs: Stored in `/data/logs/`
- Audit logs: Database table for user actions

**Metrics (Future):**
- Prometheus exporter
- Job completion rates
- Queue lengths
- System resource usage
- User activity

**Dashboards:**
- Bull Board for queue monitoring
- Custom admin dashboard for system health
- User dashboard for job statistics

## Error Handling

**Frontend:**
- Global error boundary
- Form validation errors
- API error messages displayed to user
- Retry logic for failed requests

**Backend:**
- Centralized error handling middleware
- Structured error responses
- Error logging with stack traces
- Validation errors returned with details

**Job Queue:**
- Automatic retry (3 attempts by default)
- Failed job logging
- Dead letter queue for permanent failures
- User notification on job failure

## Configuration Management

All runtime configuration via environment variables:
- Database credentials
- Redis connection
- File size limits
- Concurrent job limits
- Hashcat parameters
- Session secrets
- Feature flags

See [SETUP.md](./SETUP.md) for complete configuration reference.
