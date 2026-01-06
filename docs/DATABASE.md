# Database Schema

PostgreSQL database schema for crackhouse using Drizzle ORM.

## Overview

The database is designed to support:
- Multi-user authentication and authorization
- PCAP file tracking and network extraction
- Dictionary management (uploaded and generated)
- Hashcat job queuing and execution
- Result storage and audit logging

## Schema Diagram

```
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       ├──────────────┬──────────────┬──────────────┬──────────────┐
       │              │              │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼──────┐
│  sessions   │ │ captures  │ │dictionary │ │   jobs    │ │ audit_logs │
└─────────────┘ └─────┬─────┘ └───────────┘ └─────┬─────┘ └────────────┘
                      │                            │
                ┌─────▼─────┐                      │
                │ networks  │◄─────────────────────┤
                └─────┬─────┘                      │
                      │                            │
                ┌─────▼─────┐              ┌───────┴────────┐
                │  results  │              │  job_networks  │
                └───────────┘              │job_dictionaries│
                                           └────────────────┘
```

## Tables

### users

Stores user accounts and authentication information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin', 'superuser')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP  -- Soft delete
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `email`: User's email address (unique, used for login)
- `password_hash`: Bcrypt hashed password
- `role`: User role (user, admin, superuser)
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp
- `last_login_at`: Last successful login
- `is_active`: Account active status
- `deleted_at`: Soft delete timestamp (NULL = not deleted)

**Constraints:**
- At least one superuser must exist
- Email must be valid email format
- Password hash must be bcrypt format

---

### sessions

Stores active user sessions.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

**Columns:**
- `id`: Session identifier
- `user_id`: Reference to users table
- `token`: Session token (used in cookies/headers)
- `ip_address`: Client IP address
- `user_agent`: Client user agent string
- `created_at`: Session creation time
- `expires_at`: Session expiration time
- `last_activity_at`: Last request timestamp

**Cleanup:**
- Expired sessions are automatically deleted by a cron job
- Sessions are deleted when user is deleted (CASCADE)

---

### captures

Stores metadata about uploaded PCAP files.

```sql
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  network_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_status ON captures(status);
CREATE INDEX idx_captures_uploaded_at ON captures(uploaded_at DESC);
```

**Columns:**
- `id`: Capture identifier
- `user_id`: Owner of the capture
- `filename`: Stored filename (sanitized)
- `original_filename`: Original uploaded filename
- `file_path`: Full path to stored file
- `file_size`: File size in bytes
- `status`: Processing status
  - `pending`: Uploaded, awaiting processing
  - `processing`: Currently being converted
  - `completed`: Successfully processed
  - `failed`: Processing failed
- `error_message`: Error details if failed
- `uploaded_at`: Upload timestamp
- `processed_at`: Processing completion timestamp
- `network_count`: Number of networks extracted
- `deleted_at`: Soft delete timestamp

---

### networks

Stores WiFi networks extracted from PCAP files.

```sql
CREATE TABLE networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ssid VARCHAR(32) NOT NULL,
  bssid VARCHAR(17) NOT NULL,  -- MAC address format AA:BB:CC:DD:EE:FF
  handshake_type VARCHAR(20),  -- EAPOL, PMKID, etc.
  hc22000_file_path TEXT NOT NULL,
  extracted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_cracked BOOLEAN DEFAULT false,
  cracked_at TIMESTAMP,
  deleted_at TIMESTAMP,

  UNIQUE(bssid, capture_id)  -- Prevent duplicate networks per capture
);

CREATE INDEX idx_networks_capture_id ON networks(capture_id);
CREATE INDEX idx_networks_user_id ON networks(user_id);
CREATE INDEX idx_networks_ssid ON networks(ssid);
CREATE INDEX idx_networks_bssid ON networks(bssid);
CREATE INDEX idx_networks_is_cracked ON networks(is_cracked);
```

**Columns:**
- `id`: Network identifier
- `capture_id`: Source capture file
- `user_id`: Owner (denormalized for easier queries)
- `ssid`: Network name (0-32 characters)
- `bssid`: Access point MAC address
- `handshake_type`: Type of handshake captured
- `hc22000_file_path`: Path to converted hc22000 file
- `extracted_at`: Extraction timestamp
- `is_cracked`: Whether password has been cracked
- `cracked_at`: When password was cracked
- `deleted_at`: Soft delete timestamp

**Notes:**
- BSSID + capture_id must be unique (same network can appear in different captures)
- SSID can be empty string for hidden networks

---

### dictionaries

Stores wordlist metadata (both uploaded and generated).

```sql
CREATE TABLE dictionaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('uploaded', 'generated')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('ready', 'generating', 'failed')),
  file_path TEXT,
  file_size BIGINT,
  line_count BIGINT,
  generation_options JSONB,  -- For generated dictionaries
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_dictionaries_user_id ON dictionaries(user_id);
CREATE INDEX idx_dictionaries_type ON dictionaries(type);
CREATE INDEX idx_dictionaries_status ON dictionaries(status);
CREATE INDEX idx_dictionaries_created_at ON dictionaries(created_at DESC);
```

**Columns:**
- `id`: Dictionary identifier
- `user_id`: Owner
- `name`: User-friendly name
- `type`: uploaded or generated
- `status`:
  - `ready`: Ready to use
  - `generating`: Being generated (type=generated only)
  - `failed`: Generation/upload failed
- `file_path`: Path to wordlist file
- `file_size`: File size in bytes
- `line_count`: Number of lines/passwords
- `generation_options`: JSON object with generation parameters (for type=generated)
  ```json
  {
    "keywords": ["password", "wifi"],
    "includeUppercase": true,
    "leetSpeak": true,
    "specialCharPadding": true
  }
  ```
- `error_message`: Error details if failed
- `created_at`: Creation timestamp
- `completed_at`: When generation/upload completed
- `deleted_at`: Soft delete timestamp

---

### jobs

Stores hashcat job metadata and status.

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'active', 'completed', 'failed', 'cancelled')),
  attack_mode VARCHAR(20) NOT NULL DEFAULT 'straight',
  hashcat_options JSONB,
  progress DECIMAL(5,2) DEFAULT 0,  -- 0.00 to 100.00
  current_speed VARCHAR(50),  -- e.g., "150.5 kH/s"
  time_remaining INTEGER,  -- seconds
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,  -- seconds
  queue_position INTEGER,
  cracked_count INTEGER DEFAULT 0,
  total_networks INTEGER NOT NULL,
  total_dictionaries INTEGER NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_queue_position ON jobs(queue_position) WHERE status = 'waiting';
```

**Columns:**
- `id`: Job identifier
- `user_id`: Owner
- `name`: User-friendly job name
- `status`:
  - `waiting`: Queued, not started
  - `active`: Currently running
  - `completed`: Finished successfully
  - `failed`: Error occurred
  - `cancelled`: User cancelled
- `attack_mode`: Hashcat attack mode (straight, combinator, mask, etc.)
- `hashcat_options`: JSON object with hashcat parameters
  ```json
  {
    "workloadProfile": 3,
    "optimized": true,
    "rules": ["best64.rule"]
  }
  ```
- `progress`: Percentage complete (0-100)
- `current_speed`: Current hash rate
- `time_remaining`: Estimated seconds remaining
- `error_message`: Error details if failed
- `created_at`: Job creation time
- `started_at`: When job started running
- `completed_at`: When job finished
- `duration`: Total runtime in seconds
- `queue_position`: Position in queue (NULL if not waiting)
- `cracked_count`: Number of passwords cracked
- `total_networks`: Count of networks in job
- `total_dictionaries`: Count of dictionaries in job
- `deleted_at`: Soft delete timestamp

---

### job_networks

Many-to-many junction table linking jobs to networks.

```sql
CREATE TABLE job_networks (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (job_id, network_id)
);

CREATE INDEX idx_job_networks_job_id ON job_networks(job_id);
CREATE INDEX idx_job_networks_network_id ON job_networks(network_id);
```

**Columns:**
- `job_id`: Reference to job
- `network_id`: Reference to network
- `created_at`: When network was added to job

---

### job_dictionaries

Many-to-many junction table linking jobs to dictionaries.

```sql
CREATE TABLE job_dictionaries (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  dictionary_id UUID NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (job_id, dictionary_id)
);

CREATE INDEX idx_job_dictionaries_job_id ON job_dictionaries(job_id);
CREATE INDEX idx_job_dictionaries_dictionary_id ON job_dictionaries(dictionary_id);
```

**Columns:**
- `job_id`: Reference to job
- `dictionary_id`: Reference to dictionary
- `created_at`: When dictionary was added to job

---

### results

Stores cracked passwords.

```sql
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE SET NULL,
  dictionary_id UUID NOT NULL REFERENCES dictionaries(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password VARCHAR(255) NOT NULL,  -- Plaintext password (security consideration)
  cracked_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(network_id)  -- Each network can only have one result
);

CREATE INDEX idx_results_network_id ON results(network_id);
CREATE INDEX idx_results_job_id ON results(job_id);
CREATE INDEX idx_results_user_id ON results(user_id);
CREATE INDEX idx_results_cracked_at ON results(cracked_at DESC);
```

**Columns:**
- `id`: Result identifier
- `network_id`: Network that was cracked
- `job_id`: Job that cracked it (NULL if job deleted)
- `dictionary_id`: Dictionary used (NULL if dictionary deleted)
- `user_id`: Owner
- `password`: **Plaintext password** (stored for user convenience)
- `cracked_at`: When password was cracked

**Security Note:**
- Passwords are stored in plaintext for user convenience
- Future enhancement: Optional encryption at rest
- Users should be aware of this security tradeoff

---

### config

Stores system-wide configuration.

```sql
CREATE TABLE config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
```

**Columns:**
- `key`: Configuration key (e.g., "max_concurrent_jobs")
- `value`: JSON value
- `description`: Human-readable description
- `updated_at`: Last update timestamp
- `updated_by`: User who made the change

**Default Configuration:**
```sql
INSERT INTO config (key, value, description) VALUES
  ('max_concurrent_jobs', '2', 'Maximum simultaneous hashcat jobs'),
  ('max_pcap_size', '524288000', 'Maximum PCAP upload size (bytes)'),
  ('max_dictionary_size', '10737418240', 'Maximum dictionary size (bytes)'),
  ('max_generated_dict_size', '21474836480', 'Maximum generated dictionary size (bytes)'),
  ('max_generation_keywords', '50', 'Maximum keywords for dictionary generation'),
  ('hashcat_default_workload', '3', 'Default hashcat workload profile (1-4)'),
  ('hashcat_job_timeout', '86400', 'Default job timeout (seconds)'),
  ('allow_user_registration', 'false', 'Allow public user registration');
```

---

### audit_logs

Stores audit trail of user actions.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,  -- e.g., "user.created", "job.started", "config.updated"
  resource_type VARCHAR(50),     -- e.g., "user", "job", "capture"
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**Columns:**
- `id`: Log entry identifier
- `user_id`: User who performed action (NULL for system actions)
- `action`: Action performed (dot notation)
- `resource_type`: Type of resource affected
- `resource_id`: ID of affected resource
- `details`: JSON object with additional context
- `ip_address`: Client IP
- `user_agent`: Client user agent
- `created_at`: Timestamp

**Example Actions:**
- `auth.login`
- `auth.logout`
- `auth.failed_login`
- `user.created`
- `user.updated`
- `user.deleted`
- `capture.uploaded`
- `capture.deleted`
- `job.created`
- `job.started`
- `job.completed`
- `job.cancelled`
- `config.updated`
- `result.found`

---

## Relationships

### One-to-Many

- `users` → `sessions` (one user, many sessions)
- `users` → `captures` (one user, many captures)
- `users` → `dictionaries` (one user, many dictionaries)
- `users` → `jobs` (one user, many jobs)
- `users` → `audit_logs` (one user, many log entries)
- `captures` → `networks` (one capture, many networks)
- `networks` → `results` (one network, one result - unique constraint)

### Many-to-Many

- `jobs` ↔ `networks` (via `job_networks`)
- `jobs` ↔ `dictionaries` (via `job_dictionaries`)

## Indexes

Indexes are created for:
- Foreign keys (for JOIN performance)
- Commonly queried fields (email, status, timestamps)
- Unique constraints
- Soft delete queries (WHERE deleted_at IS NULL)

## Drizzle ORM Schema

Example Drizzle schema definition:

```typescript
// schema/users.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  isActive: boolean('is_active').default(true),
  deletedAt: timestamp('deleted_at'),
});

// schema/networks.ts
export const networks = pgTable('networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  captureId: uuid('capture_id').notNull().references(() => captures.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ssid: varchar('ssid', { length: 32 }).notNull(),
  bssid: varchar('bssid', { length: 17 }).notNull(),
  handshakeType: varchar('handshake_type', { length: 20 }),
  hc22000FilePath: text('hc22000_file_path').notNull(),
  extractedAt: timestamp('extracted_at').notNull().defaultNow(),
  isCracked: boolean('is_cracked').default(false),
  crackedAt: timestamp('cracked_at'),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  uniqueBssidPerCapture: unique().on(table.bssid, table.captureId),
}));
```

## Migrations

Migrations are managed by Drizzle Kit.

**Generate migration:**
```bash
npm run db:generate
```

**Apply migration:**
```bash
npm run db:migrate
```

**Seed initial data:**
```bash
npm run db:seed
```

## Data Retention

### Soft Deletes

Most tables use soft deletes (deleted_at column) to maintain referential integrity and audit trails.

**Query active records:**
```sql
SELECT * FROM captures WHERE deleted_at IS NULL;
```

### Hard Deletes (Future)

Implement cleanup jobs for:
- Sessions older than 30 days
- Audit logs older than 1 year
- Soft-deleted records older than 90 days

### Cascade Deletes

When a user is deleted:
- All their sessions are deleted (CASCADE)
- All their captures are soft-deleted
- All their networks are soft-deleted
- All their jobs are soft-deleted
- Audit logs remain (SET NULL on user_id)

## Performance Considerations

### Connection Pooling

```typescript
// Drizzle with PostgreSQL pool
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
  max: parseInt(process.env.DATABASE_POOL_MAX) || 10,
});

export const db = drizzle(pool);
```

### Query Optimization

- Use indexes for frequent queries
- Avoid N+1 queries with JOIN or batching
- Use pagination for large result sets
- Denormalize when necessary (e.g., user_id in networks table)

### Monitoring

Monitor slow queries:
```sql
-- Enable slow query logging
ALTER DATABASE crackhouse SET log_min_duration_statement = 1000;  -- 1 second

-- View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

## Backup Strategy

See [SETUP.md](./SETUP.md#database-backups) for backup procedures.

**Recommended:**
- Daily automated backups
- Keep 30 days of backups
- Test restores monthly
- Store backups off-site

## Security

### Password Storage

- User passwords hashed with bcrypt (12 rounds by default)
- Never log or expose password hashes

### SQL Injection Prevention

- Use parameterized queries (Drizzle handles this)
- Never concatenate user input into queries

### Access Control

- Row-level security via application logic
- Users can only access their own resources
- Admins can access all resources
- Superusers have full access

### Sensitive Data

**⚠️ Security Consideration:**

Cracked WiFi passwords are stored in **plaintext** in the `results` table. This is intentional for user convenience, but users should be aware:

- Database should be encrypted at rest
- Access should be restricted
- Consider the legal and ethical implications
- Future: Add optional encryption for results table
