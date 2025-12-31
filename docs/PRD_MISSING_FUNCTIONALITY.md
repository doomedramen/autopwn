# Product Requirements Document (PRD)

# AutoPWN Missing Functionality

**Version:** 1.0
**Date:** December 31, 2025
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Priorities](#priorities)
3. [Critical MVP Features](#critical-mvp-features)
4. [Important Missing Features](#important-missing-features)
5. [Roadmap Features](#roadmap-features)
6. [Success Criteria](#success-criteria)
7. [Dependencies](#dependencies)
8. [Risks & Mitigation](#risks--mitigation)

---

## Executive Summary

This PRD documents all missing functionality in the AutoPWN codebase compared to the documented requirements in README.md, API.md, PROJECT_PLAN.md, and ROADMAP.md.

**Current Status:**

- Backend infrastructure is ~70% complete
- Frontend dashboard is ~60% complete
- Core functionality (jobs, networks, dictionaries, users) working
- Critical gaps in PCAP management, configuration, and audit logging

**Goal:**
Complete all MVP features to achieve a production-ready v0.1.0 release as defined in PROJECT_PLAN.md.

---

## Priorities

### P0 - Critical (MVP Blockers)

Must complete before v0.1.0 release

- Captures management system
- Configuration management
- Audit logging
- Health check endpoint
- Complete rate limiting

### P1 - High (Production Ready)

Should complete before v0.1.0 release

- Captures UI pages
- Admin config UI
- Results export
- Complete pagination
- Error handling improvements

### P2 - Medium (Post-MVP)

Planned for v0.2.0 - v0.8.0

- API key authentication
- Pwnagotchi integration
- Advanced hashcat modes
- Bulk operations
- Job scheduling

---

## Critical MVP Features

### 1. Captures Management System

**Priority:** P0
**Status:** Not Started
**Effort:** 3-4 days

#### Requirements

##### 1.1 Database Schema

**Description:** Create `captures` table to track uploaded PCAP files.

**Fields:**

- `id` (UUID, primary key)
- `filename` (VARCHAR 255) - Original filename
- `userId` (TEXT, FK to users) - Owner
- `status` (ENUM: pending, processing, completed, failed)
- `fileSize` (BIGINT) - Size in bytes
- `filePath` (VARCHAR 1000) - Storage path
- `networkCount` (INTEGER) - Number of networks extracted
- `uploadedAt` (TIMESTAMP)
- `processedAt` (TIMESTAMP, nullable)
- `errorMessage` (TEXT, nullable)
- `metadata` (JSONB, nullable) - PCAP analysis results

**Success Criteria:**

- [ ] Table created in database with all fields
- [ ] Foreign key constraint to users table with cascade delete
- [ ] Indexes on userId, status, uploadedAt
- [ ] Migration script created and tested
- [ ] Schema exported to TypeScript types

##### 1.2 Captures API Routes

**Description:** Implement CRUD API endpoints for captures management.

**Endpoints:**

**GET /api/v1/captures**

- Authentication required
- Query params: `page`, `limit`, `status`, `sort`, `order`
- Returns list of user's captures with pagination
- Admins/superusers can see all captures

**POST /api/v1/captures/upload**

- Authentication required
- multipart/form-data upload
- File validation: .pcap, .cap, .pcapng
- Max file size: 500MB (configurable)
- Creates capture record with status "pending"
- Queues PCAP processing job
- Returns capture ID

**GET /api/v1/captures/:id**

- Authentication required
- Returns capture details
- Includes list of extracted networks
- Users can only see their own captures (unless admin)

**DELETE /api/v1/captures/:id**

- Authentication required
- Users can delete own captures
- Admins/superusers can delete any capture
- Deletes file from storage
- Cascades to networks (or updates network ownership)

**Success Criteria:**

- [ ] All endpoints implemented with proper validation
- [ ] RBAC enforced (users see own data only)
- [ ] File upload with progress tracking works
- [ ] Pagination works correctly
- [ ] Error handling with proper HTTP status codes
- [ ] Rate limiting applied to upload endpoint
- [ ] All endpoints tested with integration tests
- [ ] API documentation updated

##### 1.3 PCAP Processing Worker Integration

**Description:** Update existing PCAP processing to associate with captures.

**Changes:**

- When PCAP is uploaded, create captures record
- Update capture status during processing
- Store network count in captures record
- Store PCAP metadata in JSONB field
- Handle errors and update capture status to failed

**Success Criteria:**

- [ ] Upload creates capture record
- [ ] Processing updates capture status
- [ ] Errors captured in errorMessage field
- [ ] Network count accurately populated
- [ ] Worker logs capture ID for debugging

##### 1.4 Captures Management UI

**Description:** Create frontend pages to manage PCAP captures.

**Pages:**

**Captures Tab** (in dashboard)

- Table showing all captures
- Columns: Filename, Status, Size, Networks Count, Upload Date, Actions
- Filters: Status
- Search: Filename
- Pagination: 20 per page
- Actions per row: View Details, Delete

**Capture Detail Modal**

- Show full capture information
- List all extracted networks
- Link to each network's job history
- Download PCAP file
- Delete capture button

**Success Criteria:**

- [ ] Captures tab displays in dashboard
- [ ] List loads with correct data
- [ ] Filtering and search work
- [ ] Pagination works
- [ ] View details modal shows all info
- [ ] Delete functionality works with confirmation
- [ ] Empty states show helpful messages
- [ ] Loading states displayed
- [ ] Error handling with user-friendly messages
- [ ] E2E tests for capture management workflow

---

### 2. Configuration Management System

**Priority:** P0
**Status:** Not Started
**Effort:** 2-3 days

#### Requirements

##### 2.1 Database Schema

**Description:** Create `config` table for runtime configuration.

**Fields:**

- `id` (TEXT, primary key) - Config key
- `value` (JSONB) - Config value
- `description` (TEXT) - Human-readable description
- `category` (VARCHAR 50) - Section (general, security, performance)
- `type` (VARCHAR 20) - Value type (number, string, boolean)
- `defaultValue` (JSONB) - Default value
- `minValue` (NUMBER, nullable) - For numeric validation
- `maxValue` (NUMBER, nullable) - For numeric validation
- `isReadOnly` (BOOLEAN) - Cannot be changed
- `requiresRestart` (BOOLEAN) - Changes require service restart
- `updatedAt` (TIMESTAMP) - Last update time
- `updatedBy` (TEXT, nullable) - User who updated

**Initial Configuration:**

- `maxConcurrentJobs` (number, default: 2)
- `maxPcapSize` (number, default: 524288000)
- `maxDictionarySize` (number, default: 10737418240)
- `maxGeneratedDictSize` (number, default: 21474836480)
- `hashcatDefaultWorkload` (number, default: 3)
- `hashcatJobTimeout` (number, default: 86400)
- `allowUserRegistration` (boolean, default: false)
- `sessionExpiry` (number, default: 604800)

**Success Criteria:**

- [ ] Table created with all fields
- [ ] Initial config seeded via migration
- [ ] Indexes on id, category
- [ ] Validation constraints applied
- [ ] TypeScript types generated

##### 2.2 Config API Routes

**Description:** Implement configuration management endpoints.

**Endpoints:**

**GET /api/v1/config**

- Superuser only
- Returns all configuration values
- Includes validation metadata
- Excludes sensitive values

**GET /api/v1/config/:id**

- Superuser only
- Returns single config item with full details

**PATCH /api/v1/config**

- Superuser only
- Body: `{ updates: [{ id: string, value: any }] }`
- Validates each update:
  - Type matches config type
  - Value within min/max bounds
  - Not read-only
- Logs all changes to audit log
- Returns updated values
- Note if restart required

**Success Criteria:**

- [ ] All endpoints implemented
- [ ] Superuser RBAC enforced
- [ ] Validation logic correct
- [ ] Audit logging working
- [ ] Error handling for invalid updates
- [ ] Tests for all scenarios

##### 2.3 Config Service

**Description:** Create centralized config service for backend.

**Responsibilities:**

- Load config from database on startup
- Cache config values (TTL: 5 minutes)
- Provide typed getter functions
- Invalidate cache on updates
- Watch for config changes (optional)

**API:**

```typescript
class ConfigService {
  get(key: string): any;
  getNumber(key: string): number;
  getString(key: string): string;
  getBoolean(key: string): boolean;
  reload(): Promise<void>;
  invalidate(key: string): void;
}
```

**Success Criteria:**

- [ ] Service implemented with caching
- [ ] All backend code uses ConfigService
- [ ] Configuration reloads on update
- [ ] Environment variable overrides work
- [ ] Unit tests for service

##### 2.4 Admin Config UI

**Description:** Create superuser configuration management page.

**Page Features:**

- Grouped by category (General, Security, Performance)
- Each config item shows:
  - Description
  - Current value (editable input)
  - Default value (for reference)
  - Validation hints (min/max)
  - Requires restart indicator
- Save changes button
- Reset to defaults button
- Audit log of recent changes

**Success Criteria:**

- [ ] Admin tab includes config section
- [ ] Config items grouped and organized
- [ ] Validation prevents invalid input
- [ ] Save updates backend
- [ ] Reset to defaults works
- [ ] Shows recent audit log entries
- [ ] Restart warnings displayed
- [ ] E2E tests for config changes

---

### 3. Audit Logging System

**Priority:** P0
**Status:** Not Started
**Effort:** 2 days

#### Requirements

##### 3.1 Database Schema

**Description:** Create `audit_logs` table for security event tracking.

**Fields:**

- `id` (UUID, primary key)
- `userId` (TEXT, FK to users, nullable) - Who performed action
- `action` (VARCHAR 100) - Action performed (e.g., "user_created", "config_updated")
- `entityType` (VARCHAR 50) - Type of entity affected (user, config, job, etc.)
- `entityId` (TEXT, nullable) - ID of affected entity
- `oldValue` (JSONB, nullable) - Previous state
- `newValue` (JSONB, nullable) - New state
- `changes` (JSONB, nullable) - Array of changed fields
- `ipAddress` (VARCHAR 45) - IP address of request
- `userAgent` (TEXT) - User agent string
- `success` (BOOLEAN) - Whether action succeeded
- `errorMessage` (TEXT, nullable) - Error message if failed
- `metadata` (JSONB, nullable) - Additional context
- `createdAt` (TIMESTAMP) - When action occurred

**Success Criteria:**

- [ ] Table created with all fields
- [ ] Indexes on userId, action, entityType, createdAt
- [ ] Foreign key to users with null on delete
- [ ] Migration created and tested

##### 3.2 Audit Service

**Description:** Create centralized audit logging service.

**Responsibilities:**

- Log all security-relevant events
- Capture context (user, IP, user agent)
- Log changes (old/new values)
- Async logging for performance
- Provide query interface

**API:**

```typescript
class AuditService {
  log(params: {
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    metadata?: any;
  }): Promise<void>;

  query(params: {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<AuditLog[]>;
}
```

**Events to Log:**

- Authentication (login, logout, failed login)
- User management (create, update, delete)
- Role changes
- Config updates
- File uploads
- Job creation/cancellation
- Security events (rate limit exceeded, suspicious activity)

**Success Criteria:**

- [ ] Service implemented with async logging
- [ ] All critical events logged
- [ ] Context captured correctly
- [ ] Query interface working
- [ ] Performance impact <10ms per log
- [ ] Unit tests for service

##### 3.3 Audit Logging Middleware

**Description:** Create Hono middleware to auto-log API requests.

**Features:**

- Automatically log all mutating requests (POST, PUT, PATCH, DELETE)
- Extract request context (IP, user agent, user)
- Log response status
- Log on error

**Usage:**

```typescript
app.use(
  "/api/v1/sensitive",
  auditLoggingMiddleware({
    actions: {
      "POST /api/v1/users": "user_created",
      "PATCH /api/v1/users/:id": "user_updated",
      // ...
    },
  }),
);
```

**Success Criteria:**

- [ ] Middleware implemented
- [ ] Logs all specified actions
- [ ] Captures request/response context
- [ ] Works with existing auth middleware
- [ ] Performance impact minimal
- [ ] Tests for middleware

##### 3.4 Audit Log Query API

**Description:** Implement audit log query endpoint.

**Endpoint:**

**GET /api/v1/audit-logs**

- Admin/superuser only
- Query params:
  - `userId` - Filter by user
  - `action` - Filter by action type
  - `entityType` - Filter by entity type
  - `startDate` - Filter from date
  - `endDate` - Filter to date
  - `page`, `limit` - Pagination
- Returns paginated audit logs
- Includes user details

**Success Criteria:**

- [ ] Endpoint implemented
- [ ] RBAC enforced
- [ ] All query parameters work
- [ ] Pagination correct
- [ ] Performance tested with large datasets

##### 3.5 Audit Log Viewer UI

**Description:** Create admin page to view audit logs.

**Page Features:**

- Table showing audit log entries
- Columns: Timestamp, User, Action, Entity, Changes, IP Address
- Filters: User, Action, Date Range
- Pagination
- Click entry to see full details (old/new values)
- Export to CSV

**Success Criteria:**

- [ ] Audit log tab in admin section
- [ ] Table displays correctly
- [ ] All filters work
- [ ] Detail view shows old/new values
- [ ] Export to CSV works
- [ ] Performance acceptable with thousands of entries

---

### 4. Health Check Endpoint

**Priority:** P0
**Status:** Not Started
**Effort:** 0.5 days

#### Requirements

##### 4.1 Health Check Implementation

**Description:** Implement comprehensive health check endpoint.

**Endpoint:**

**GET /health**

- No authentication required
- Checks:
  - Database connection
  - Redis connection
  - File system access (read/write test)
  - Queue health (BullMQ status)
  - External tools (hashcat, hcxpcapngtool availability)
- Returns overall status and component status

**Response Format:**

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-12-31T12:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "filesystem": {
      "status": "healthy",
      "writeable": true
    },
    "queue": {
      "status": "healthy",
      "activeJobs": 2,
      "queuedJobs": 5
    },
    "tools": {
      "hashcat": "available",
      "hcxpcapngtool": "available"
    }
  }
}
```

**Success Criteria:**

- [ ] Endpoint implemented at /health
- [ ] All health checks working
- [ ] Returns correct JSON format
- [ ] Response time <100ms
- [ ] Returns 200 for healthy, 503 for unhealthy
- [ ] No authentication required
- [ ] Tests for all health check scenarios

##### 4.2 Docker Health Checks

**Description:** Configure Docker Compose health checks.

**Changes:**

- Add healthcheck to all services in docker-compose.yml
- Use /health endpoint for API service
- Check database connection for PostgreSQL
- Check Redis PING for Redis
- Appropriate intervals and timeouts

**Success Criteria:**

- [ ] Health checks added to docker-compose.yml
- [ ] Docker reports healthy/unhealthy status
- [ ] Unhealthy containers restart automatically
- [ ] Kubernetes-style readiness checks work

---

### 5. Complete Rate Limiting

**Priority:** P0
**Status:** Partial Implementation
**Effort:** 1 day

#### Requirements

##### 5.1 Rate Limiting Strategy

**Description:** Apply rate limiting to all API endpoints.

**Limits by Endpoint Type:**

- Authentication endpoints: 10 requests/minute
- File upload: 5 requests/minute
- API read operations: 100 requests/minute
- API write operations: 20 requests/minute
- Admin endpoints: 50 requests/minute

**Storage:**

- Use Redis for distributed rate limiting (already implemented)
- Fallback to in-memory for testing
- Per-user rate limiting keys
- Keys expire after rate limit window

**Success Criteria:**

- [ ] All endpoints have appropriate rate limits
- [ ] Redis-backed rate limiting works
- [ ] In-memory fallback works in tests
- [ ] Rate limit headers returned (X-RateLimit-\*)
- [ ] 429 status code on exceeded
- [ ] Tests verify rate limiting works

##### 5.2 Rate Limiting Headers

**Description:** Return rate limit information in response headers.

**Headers:**

- `X-RateLimit-Limit` - Max requests per window
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Unix timestamp when window resets
- `X-RateLimit-Backend` - Redis or memory

**Success Criteria:**

- [ ] Headers included in all responses
- [ ] Values calculated correctly
- [ ] Resets at correct time
- [ ] Tests verify header accuracy

---

## Important Missing Features

### 6. Captures UI Pages

**Priority:** P1
**Status:** Not Started
**Effort:** 2 days

See section 1.4 for detailed requirements.

**Additional Requirements:**

- Add captures tab to main dashboard
- Integrate with existing stats cards
- Add capture count to dashboard stats
- Add "Upload PCAP" button to captures tab
- Show capture processing status with progress
- Link captures to networks tab
- Link to jobs created from capture

**Success Criteria:**

- [ ] Captures tab accessible from dashboard
- [ ] Dashboard stats include capture count
- [ ] Upload modal accessible from captures tab
- [ ] Capture list displays correctly
- [ ] Status indicators accurate
- [ ] Links to networks/jobs work
- [ ] Responsive design on mobile

---

### 7. Admin Config UI

**Priority:** P1
**Status:** Not Started
**Effort:** 1-2 days

See section 2.4 for detailed requirements.

**Additional Requirements:**

- Add config section to admin tab
- Organize config into collapsible sections
- Show validation errors inline
- Add confirmation for sensitive config changes
- Display config version/history
- Allow searching/filtering config items

**Success Criteria:**

- [ ] Config accessible from admin tab
- [ ] All config items displayed
- [ ] Grouping and organization clear
- [ ] Validation prevents invalid input
- [ ] Confirmation dialogs for critical changes
- [ ] History shows recent changes
- [ ] Search/filter functionality works

---

### 8. Results Export

**Priority:** P1
**Status:** Not Started
**Effort:** 1 day

#### Requirements

##### 8.1 Export API Endpoint

**Description:** Add export functionality to results API.

**Endpoint:**

**GET /api/v1/results/export**

- Authentication required
- Query params:
  - `format` - csv, json, txt (default: json)
  - `jobId` - Filter by job
  - `startDate` - Filter from date
  - `endDate` - Filter to date
- Returns file in specified format
- Includes: SSID, BSSID, Password, Dictionary, CrackedAt, JobId

**Success Criteria:**

- [ ] Endpoint implemented
- [ ] All formats work (CSV, JSON, TXT)
- [ ] Filters applied correctly
- [ ] File download triggered in browser
- [ ] Filename includes date and format
- [ ] Tests for all formats

##### 8.2 Export UI

**Description:** Add export buttons to results page.

**Features:**

- Dropdown button with format options
- Bulk export all results
- Export filtered results
- Show success message after export
- Export to cloud storage (optional, future)

**Success Criteria:**

- [ ] Export button on results page
- [ ] Format options available
- [ ] Download starts on click
- [ ] Success notification displayed
- [ ] Works with filtered results
- [ ] E2E tests for export workflow

---

### 9. Complete Pagination

**Priority:** P1
**Status:** Partial Implementation
**Effort:** 1 day

#### Requirements

##### 9.1 Pagination Implementation

**Description:** Add pagination to all list endpoints.

**Endpoints to Update:**

- GET /api/v1/networks - Add pagination
- GET /api/v1/dictionaries - Add pagination
- GET /api/v1/captures - Add pagination
- GET /api/v1/users - Add pagination (improve existing)
- GET /api/v1/audit-logs - Add pagination

**Standard Pagination Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- Response includes pagination object:
  ```json
  {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
  ```

**Performance Optimization:**

- Use COUNT(\*) queries for total
- Add appropriate database indexes
- Limit max page to prevent deep pagination attacks
- Cache frequently accessed pages (optional)

**Success Criteria:**

- [ ] All list endpoints have pagination
- [ ] Total count accurate
- [ ] Pagination object correct
- [ ] Max page limit enforced
- [ ] Performance tested with 10k+ records
- [ ] Database indexes added

##### 9.2 Pagination UI Components

**Description:** Create reusable pagination component.

**Component Features:**

- Show current page and total pages
- Previous/Next buttons
- Page number buttons (with truncation for many pages)
- Page size selector (10, 20, 50, 100)
- Jump to page input

**Success Criteria:**

- [ ] Reusable pagination component created
- [ ] Used on all list pages
- [ ] Styling consistent
- [ ] Accessibility (keyboard navigation, ARIA)
- [ ] Works with filters and search
- [ ] Mobile responsive

---

## Roadmap Features

### 10. API Key Authentication

**Priority:** P2
**Status:** Not Started
**Effort:** 3-4 days
**Target Version:** v0.8.0

#### Requirements

##### 10.1 Database Schema

**Table: api_keys**

**Fields:**

- `id` (UUID, primary key)
- `userId` (TEXT, FK to users)
- `name` (VARCHAR 255) - User-defined name
- `keyHash` (VARCHAR 255) - Hashed API key
- `scopes` (TEXT[]) - Array of permissions
- `expiresAt` (TIMESTAMP, nullable)
- `lastUsedAt` (TIMESTAMP, nullable)
- `createdAt` (TIMESTAMP)
- `revokedAt` (TIMESTAMP, nullable)

**Scopes:**

- `upload:captures` - Upload PCAP files
- `read:captures` - Read capture data
- `create:jobs` - Create cracking jobs
- `read:results` - Read results
- `admin:config` - Manage config

**Success Criteria:**

- [ ] Table created with proper constraints
- [ ] Indexes on userId, keyHash
- [ ] Migration created
- [ ] TypeScript types generated

##### 10.2 API Key Service

**Responsibilities:**

- Generate secure API keys (32+ random chars)
- Hash keys before storage
- Validate API keys
- Check scopes/permissions
- Track last used timestamp
- Revoke keys

**Success Criteria:**

- [ ] Service implemented
- [ ] Key generation cryptographically secure
- [ ] Hashing with bcrypt/scrypt
- [ ] Scope validation works
- [ ] Revocation prevents access immediately

##### 10.3 API Key Routes

**Endpoints:**

**POST /api/v1/api-keys**

- Create new API key
- Body: `{ name, scopes[], expiresAt }`
- Returns key (display only once!)

**GET /api/v1/api-keys**

- List user's API keys
- Returns metadata only (never the key itself)

**DELETE /api/v1/api-keys/:id**

- Revoke API key
- User can only delete own keys

**Success Criteria:**

- [ ] All endpoints implemented
- [ ] Key returned only once
- [ ] RBAC enforced
- [ ] Tests for all operations

##### 10.4 API Key Auth Middleware

**Description:** Middleware to authenticate API keys.

**Features:**

- Extract from Authorization header (Bearer token)
- Validate against database
- Check scopes
- Set user context
- Track last used timestamp

**Success Criteria:**

- [ ] Middleware implemented
- [ ] Key validation works
- [ ] Scope checking correct
- [ ] Last used timestamp updated
- [ ] Performance impact minimal

##### 10.5 API Key Management UI

**Page Features:**

- List API keys with metadata
- Create new key modal
- Show key once with copy button
- Revoke key button
- Show last used date
- Filter by status

**Success Criteria:**

- [ ] UI page accessible from settings
- [ ] List displays correctly
- [ ] Create key workflow works
- [ ] Key displayed once
- [ ] Copy to clipboard works
- [ ] Revoke confirmation
- [ ] Last used date updates

---

### 11. Pwnagotchi Auto-Upload Plugin

**Priority:** P2
**Status:** Not Started
**Effort:** 3-4 days
**Target Version:** v0.8.0

#### Requirements

##### 11.1 Plugin Structure

**Location:** `apps/pwnagotchi-plugin/autopwn_uploader.py`

**Single-file plugin** with:

- Configuration loading
- PCAP file monitoring
- Upload queue
- Retry logic
- Status display

**Success Criteria:**

- [ ] Plugin file created
- [ ] Runs as single file
- [ ] Dependencies minimal (requests only)
- [ ] Compatible with Pwnagotchi plugin system

##### 11.2 Configuration

**Config File:** `/root/.autopwn/config.yml`

**Fields:**

- `url` - AutoPWN instance URL
- `apiKey` - API key for authentication
- `uploadInterval` - Seconds between upload checks
- `maxRetries` - Upload retry attempts
- `deleteAfterUpload` - Delete PCAP after successful upload

**Success Criteria:**

- [ ] Config file format defined
- [ ] Validation works
- [ ] Example config provided
- [ ] Documentation for setup

##### 11.3 Upload Logic

**Workflow:**

1. Monitor `/root/handshakes/` directory for new .pcap files
2. On new file, add to upload queue
3. When WiFi connected, process queue:
   - For each PCAP:
     - Upload via API
     - Track uploaded files in `.uploaded` state file
     - On success, delete from queue
     - On failure, retry with exponential backoff
4. Display status on Pwnagotchi screen

**API Endpoint:** POST /api/v1/captures/upload-via-api

- Authorization: Bearer <api-key>
- multipart/form-data
- Optional metadata: device_id, captured_at, location

**Success Criteria:**

- [ ] Directory monitoring works
- [ ] Upload queue functional
- [ - Retry logic with backoff
- [ ] Upload tracking prevents duplicates
- [ ] Status displayed on screen
- [ ] API endpoint implemented

##### 11.4 Plugin Documentation

**Documentation Sections:**

- Installation instructions
- Configuration guide
- Troubleshooting
- Examples
- Security notes

**Success Criteria:**

- [ ] README created
- [ ] Installation steps clear
- [ ] Config documented
- [ ] Common issues covered
- [ ] Security warnings included

---

### 12. Advanced Hashcat Features

**Priority:** P2
**Status:** Not Started
**Effort:** 5-7 days
**Target Version:** v1.0.0

#### Requirements

##### 12.1 Attack Modes

**Modes to Implement:**

**Straight** (already implemented)

- Dictionary-based
- Mode 0

**Combinator**

- Combine two dictionaries
- Mode 1
- UI: Select primary and secondary dictionaries

**Brute Force / Mask**

- Character set attacks
- Mode 3
- UI: Mask builder (custom charset, position, length)
- Presets: Common patterns (8 digits, dates, etc.)

**Hybrid**

- Dictionary + mask
- Mode 6 and 7
- UI: Dictionary + mask configuration

**Rule-based**

- Apply transformation rules
- Mode 0 with rules file
- UI: Rule selector, upload custom rules
- Built-in rules: Best64, OneRuleToRuleThemAll

**PRINCE**

- Probabilistic word generation
- External tool integration
- UI: Word list, rules, optimization level

**Success Criteria:**

- [ ] All attack modes implemented in worker
- [ ] Hashcat command builder updated
- [ ] UI allows mode selection
- [ ] Validation for each mode's parameters
- [ ] Tests for each mode

##### 12.2 Job Configuration UI

**Form Fields:**

- Attack mode selector
- Mode-specific fields (dynamic based on selection)
- Dictionary selection (multi-select)
- Mask builder (for mask/hybrid modes)
- Rule file upload/selection (for rule-based)
- Hashcat options:
  - Workload profile (1-4)
  - GPU device selection
  - Optimized kernel
  - Debug mode

**Success Criteria:**

- [ ] Dynamic form shows correct fields per mode
- [ ] Validation prevents invalid combinations
- [ ] Mask builder is user-friendly
- [ ] Rule file upload works
- [ ] Options documented with tooltips

##### 12.3 Job Templates

**Description:** Save and reuse job configurations.

**Features:**

- Save current job configuration as template
- Name and describe templates
- List templates
- Load template into new job form
- Delete templates
- Share templates with team (future)

**Success Criteria:**

- [ ] Save template functionality
- [ ] Template list displays
- [ ] Load template works
- [ ] Form populated correctly
- [ ] Delete template works

##### 12.4 Job Scheduling

**Description:** Schedule jobs to run at specific times.

**Features:**

- Schedule job for later execution
- Cron-like scheduling
- One-time or recurring
- View scheduled jobs
- Cancel scheduled jobs
- Queue when time arrives

**Implementation:**

- Add `scheduledFor` timestamp to jobs table
- Worker checks for scheduled jobs periodically
- Queue job when scheduled time arrives

**Success Criteria:**

- [ ] Schedule date/time picker in UI
- [ ] Cron schedule input (optional)
- [ ] Scheduled jobs listed separately
- [ ] Cancel scheduling works
- [ ] Jobs queue at correct time
- [ ] Recurring jobs work

##### 12.5 Job Dependencies

**Description:** Run jobs in sequence based on dependencies.

**Features:**

- Define job dependencies (Job B runs after Job A)
- Visual dependency graph
- Handle failures (stop chain, continue chain)
- Conditional execution (only if previous job found passwords)

**Success Criteria:**

- [ ] Dependency selection in UI
- [ ] Dependency graph visualized
- [ ] Sequential execution works
- [ ] Failure handling options
- [ ] Conditional execution implemented

---

### 13. Bulk Operations

**Priority:** P2
**Status:** Not Started
**Effort:** 2-3 days
**Target Version:** v0.6.0

#### Requirements

##### 13.1 Bulk PCAP Upload

**Description:** Upload multiple PCAP files as zip archive.

**Endpoint:** POST /api/v1/captures/upload-bulk

- Accept: multipart/form-data
- File: .zip archive
- Process:
  1. Validate zip file
  2. Extract to temp directory
  3. Process each .pcap file
  4. Create capture record for each
  5. Queue all for processing
- Returns: List of created captures

**UI:**

- Bulk upload button
- Drag and drop zip file
- Progress bar for extraction
- List of extracted files
- Start/cancel processing

**Success Criteria:**

- [ ] Bulk upload endpoint works
- [ ] Zip validation implemented
- [ ] Extraction and processing functional
- [ ] UI for bulk upload created
- [ ] Progress tracking works
- [ ] Error handling for corrupt files

##### 13.2 Bulk Job Creation

**Description:** Create multiple jobs at once.

**Endpoint:** POST /api/v1/jobs/create-bulk

- Body: Array of job configurations
- Process: Create and queue all jobs
- Returns: List of created jobs

**UI:**

- Bulk job creation modal
- Select multiple networks
- Select multiple dictionaries
- Configure job options (apply to all)
- Preview job count
- Create all jobs

**Success Criteria:**

- [ ] Bulk job endpoint implemented
- [ ] Validation for all jobs
- [ ] UI for bulk creation
- [ ] Preview shows job count
- [ ] Confirmation dialog
- [ ] Progress indicator

##### 13.3 Bulk Actions

**Description:** Perform actions on multiple items.

**UI Features:**

- Checkbox selection in tables
- Bulk action dropdown
- Actions:
  - Delete selected
  - Export selected
  - Create jobs from selected networks
  - Add to queue
- Confirmation dialog with count

**Success Criteria:**

- [ ] Checkboxes added to tables
- [ ] Selection tracking works
- [ ] Bulk actions menu functional
- [ ] All actions execute correctly
- [ ] Confirmation dialogs clear
- [ ] Progress feedback shown

---

## Success Criteria

### Overall Project Success

The AutoPWN project will be considered successful when:

#### Functional Requirements

- [ ] All P0 features implemented and tested
- [ ] All P1 features implemented and tested
- [ ] Core workflow works end-to-end:
  1. User uploads PCAP
  2. Networks extracted automatically
  3. User creates job with networks and dictionaries
  4. Job processes and cracks passwords
  5. Results displayed and exported
- [ ] Configuration can be managed via UI
- [ ] All security events logged
- [ ] System health monitorable

#### Technical Requirements

- [ ] API documentation complete and accurate
- [ ] All endpoints have tests (unit + integration)
- [ ] Code coverage >70%
- [ ] Performance meets requirements:
  - Page load <2 seconds
  - API response <200ms (p95)
  - File upload <5 seconds (500MB)
- [ ] Security requirements met:
  - Rate limiting on all endpoints
  - RBAC enforced everywhere
  - Input validation complete
  - File upload security
  - Audit logging comprehensive

#### User Experience Requirements

- [ ] All documented features accessible from UI
- [ ] Clear error messages throughout
- [ ] Loading states for all async operations
- [ ] Empty states with helpful guidance
- [ ] Responsive design on mobile
- [ ] Accessibility (WCAG 2.1 AA)

#### Deployment Requirements

- [ ] Docker Compose deployment works out of the box
- [ ] All configuration via environment variables
- [ ] Health checks functional
- [ ] Logging comprehensive and structured
- [ ] Database migrations work smoothly
- [ ] Data persistence correct

#### Documentation Requirements

- [ ] README updated with all features
- [ ] API documentation complete
- [ ] Setup guide accurate
- [ ] Deployment guide comprehensive
- [ ] Troubleshooting guide helpful
- [ ] Code comments where complex

---

## Dependencies

### Internal Dependencies

1. **Captures System** Depends On:
   - PCAP processing worker (already exists)
   - Networks API (already exists)
   - File storage manager (already exists)

2. **Config System** Depends On:
   - Database schema migration
   - All services updated to use config service

3. **Audit System** Depends On:
   - Database schema migration
   - Auth middleware (already exists)
   - User management (already exists)

4. **Rate Limiting** Depends On:
   - Redis infrastructure (already exists)
   - Rate limiting middleware (already exists)

### External Dependencies

1. **PostgreSQL 16+**
   - Database server
   - JSONB support required

2. **Redis 7+**
   - Rate limiting storage
   - Job queue

3. **Hashcat 6.2+**
   - Password cracking
   - Command-line tool

4. **hcxtools 4.2+**
   - PCAP conversion
   - Network extraction

### Technology Stack

1. **Backend**
   - Hono web framework
   - Drizzle ORM
   - Better Auth
   - BullMQ
   - TypeScript 5+

2. **Frontend**
   - Next.js 14+
   - React 18+
   - shadcn/ui
   - TanStack Query
   - TypeScript 5+

3. **Infrastructure**
   - Docker & Docker Compose
   - PostgreSQL
   - Redis
   - Nginx (reverse proxy)

---

## Risks & Mitigation

### Technical Risks

#### Risk 1: Database Schema Changes Break Existing Data

**Likelihood:** Medium
**Impact:** High

**Mitigation:**

- Create comprehensive migration scripts with rollback plans
- Test migrations on staging environment first
- Backup database before applying migrations
- Document breaking changes in upgrade guide
- Provide migration path for existing users

**Success Criterion:**

- [ ] Migration tested on staging
- [ ] Rollback procedure documented
- [ ] Backup process verified

#### Risk 2: Performance Degradation with Audit Logging

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**

- Async logging to minimize request latency
- Batch writes to database
- Implement log retention policy
- Add indexes for query performance
- Monitor database size and query performance

**Success Criterion:**

- [ ] Logging adds <10ms latency
- [ ] Queries remain <100ms
- [ ] Retention policy implemented

#### Risk 3: Rate Limiting Blocks Legitimate Users

**Likelihood:** Low
**Impact:** Medium

**Mitigation:**

- Set conservative limits initially
- Monitor rate limit violations
- Provide clear error messages
- Allow admins to whitelist IPs
- Implement exponential backoff recommendations

**Success Criterion:**

- [ ] Limits tested with realistic load
- [ ] Error messages clear
- [ ] Whitelist functionality available

#### Risk 4: Config Changes Break System

**Likelihood:** Medium
**Impact:** High

**Mitigation:**

- Validate all config updates
- Set min/max bounds
- Mark dangerous changes with warnings
- Require confirmation for sensitive changes
- Store previous values
- Implement config versioning
- Allow reset to defaults

**Success Criterion:**

- [ ] Validation prevents invalid values
- [ ] Confirmation dialogs shown
- [ ] Reset to defaults works
- [ ] Previous values accessible

### Project Risks

#### Risk 5: Scope Creep Beyond MVP

**Likelihood:** High
**Impact:** Medium

**Mitigation:**

- Strictly prioritize P0 features
- Defer P2 features to post-MVP
- Weekly scope review meetings
- Document changes to requirements
- Maintain clear MVP definition

**Success Criterion:**

- [ ] P0 features completed first
- [ ] P2 features deferred
- [ ] MVP scope maintained

#### Risk 6: Integration Issues with Existing Code

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**

- Comprehensive testing
- Incremental integration
- Backwards compatibility where possible
- Feature flags for gradual rollout
- Code review of all integrations

**Success Criterion:**

- [ ] All existing tests pass
- [ ] Integration tests added
- [ ] No breaking changes without documentation

#### Risk 7: Security Vulnerabilities in New Features

**Likelihood:** Medium
**Impact:** Critical

**Mitigation:**

- Security review of all new code
- Follow OWASP guidelines
- Use validated libraries
- Implement defense in depth
- Regular dependency updates
- Penetration testing before release

**Success Criterion:**

- [ ] Security review completed
- [ ] Penetration testing performed
- [ ] Dependencies up to date
- [ ] Code review process followed

### Timeline Risks

#### Risk 8: Delays Due to Testing Complexity

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**

- Parallel testing and development
- Test-driven development where possible
- Early integration testing
- Automated test suite
- Continuous integration

**Success Criterion:**

- [ ] Test coverage >70%
- [ ] Automated tests pass
- [ ] CI pipeline functional

#### Risk 9: Resource Constraints During Development

**Likelihood:** Low
**Impact:** Medium

**Mitigation:**

- Clear prioritization
- Focus on critical path
- Regular status updates
- Flexible scope if needed
- Efficient task breakdown

**Success Criterion:**

- [ ] Regular progress updates
- [ ] P0 features prioritized
- [ ] Timeline adjustments communicated

---

## Appendices

### Appendix A: API Endpoint Summary

#### Current Endpoints

- POST /api/v1/auth/\* (Better Auth)
- GET /api/v1/users
- POST /api/v1/users
- PATCH /api/v1/users/:id
- DELETE /api/v1/users/:id
- GET /api/v1/networks
- GET /api/v1/networks/:id
- POST /api/v1/networks
- PUT /api/v1/networks/:id
- DELETE /api/v1/networks/:id
- GET /api/v1/dictionaries
- POST /api/v1/dictionaries/upload
- POST /api/v1/dictionaries/generate
- GET /api/v1/dictionaries/:id
- DELETE /api/v1/dictionaries/:id
- GET /api/v1/jobs
- POST /api/v1/jobs/create
- GET /api/v1/jobs/:id
- POST /api/v1/jobs/:id/cancel
- DELETE /api/v1/jobs/:id
- GET /api/v1/results
- GET /api/v1/results/by-network/:networkId
- GET /api/v1/results/by-job/:jobId
- POST /api/v1/upload

#### Endpoints to Add

- GET /api/v1/captures
- POST /api/v1/captures/upload
- GET /api/v1/captures/:id
- DELETE /api/v1/captures/:id
- POST /api/v1/captures/upload-bulk
- GET /api/v1/config
- GET /api/v1/config/:id
- PATCH /api/v1/config
- GET /api/v1/audit-logs
- GET /health
- GET /api/v1/results/export
- POST /api/v1/api-keys
- GET /api/v1/api-keys
- DELETE /api/v1/api-keys/:id
- POST /api/v1/captures/upload-via-api
- POST /api/v1/jobs/create-bulk

### Appendix B: Database Schema Summary

#### Existing Tables

- users
- sessions
- accounts
- verifications
- networks
- dictionaries
- jobs
- job_results

#### Tables to Add

- captures
- config
- audit_logs
- api_keys

### Appendix C: Testing Requirements

#### Unit Tests

- All services and utilities
- Validation schemas
- Helper functions
- Target: >80% coverage

#### Integration Tests

- All API endpoints
- Database operations
- Authentication flows
- File upload/processing
- Job creation and execution

#### E2E Tests

- Complete user workflows
- Admin operations
- Error scenarios
- Cross-browser compatibility

#### Performance Tests

- API response times
- Database query performance
- File upload speeds
- Concurrent job processing

---

**Document Status:** Draft
**Last Updated:** December 31, 2025
**Next Review:** January 7, 2026

**Document Owner:** Development Team
**Approval Required:** Product Manager, Tech Lead
