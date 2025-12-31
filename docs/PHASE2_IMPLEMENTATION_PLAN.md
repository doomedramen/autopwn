# Phase 2 Implementation Plan: P1 - Important Features

## Date: December 31, 2025

## Overview

Phase 2 builds upon Phase 1's MVP foundation by adding important features for production readiness. This phase focuses on UI components, notifications, and advanced job/dictionary management.

## Timeline Estimate: 14-21 days

---

## Features to Implement (Priority Order)

### 1. Email Notifications System (Days 1-3) 🔔

**Priority:** HIGH - Foundation for other features

**Requirements:**

- Email service for sending notifications
- Email templates for different event types
- Configuration for SMTP settings
- Email queue for async sending
- Email verification and password reset (from Better Auth)

**Implementation:**

1. Create `EmailService` with nodemailer integration
2. Add email configuration to database (SMTP host, port, user, password, from)
3. Create email templates (HTML + text versions)
4. Implement email queue with BullMQ
5. Email worker for async processing
6. Better Auth integration (password reset, email verification)

**API Endpoints:**

- `POST /api/config/email-test` - Test email (superuser only)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/verify-email` - Verify email

**Email Types:**

- Job completed notification
- Job failed notification
- System health degraded/critical
- Audit security event (failed login, etc.)
- Password reset request
- Email verification

**Files to Create:**

- `apps/api/src/services/email.service.ts`
- `apps/api/src/workers/email-worker.ts`
- `apps/api/src/lib/email-templates.ts`
- `apps/api/src/routes/email.ts`
- Database migration for email config

---

### 2. Advanced Job Management (Days 4-8) 🚀

**Priority:** HIGH - High user value

**Requirements:**

- Job cancellation functionality
- Job scheduling (run at specific time)
- Job dependencies (run after job B completes)
- Bulk job operations (cancel multiple, restart failed)

**Implementation:**

1. Add job cancellation to JobsService
2. Add job scheduling (add scheduledAt field)
3. Add job dependencies (add dependsOn field)
4. Create bulk operation endpoints
5. Update job worker to check scheduling and dependencies
6. Add UI for job management

**Database Changes:**

- Add `scheduled_at` column to jobs table
- Add `depends_on` JSONB array column to jobs table
- Add `cancelled_at` nullable timestamp column

**API Endpoints:**

- `POST /api/jobs/:id/cancel` - Cancel a job
- `POST /api/jobs/bulk-cancel` - Cancel multiple jobs
- `POST /api/jobs/:id/reschedule` - Reschedule a job
- `POST /api/jobs/:id/retry` - Retry failed job
- `GET /api/jobs/scheduled` - List scheduled jobs

**Files to Create:**

- Database migration for job scheduling
- Update `apps/api/src/services/jobs.service.ts`
- Update `apps/api/src/routes/jobs.ts`
- Update `apps/api/src/workers/hashcat-executor.ts`
- UI components in `apps/web/`

---

### 3. Admin Dashboard UI (Days 9-11) 🎨

**Priority:** MEDIUM - Uses Phase 1 services

**Requirements:**

- Configuration management UI
- Audit log viewer with filtering
- System health monitoring dashboard
- User management (for admins)
- Quick actions panel

**Implementation:**

1. Create admin dashboard layout
2. Configuration form with validation
3. Audit log table with filters and export
4. Health monitoring widgets (status cards, charts)
5. User management table
6. Real-time updates (poll or WebSocket)

**UI Components to Create:**

- `apps/web/components/admin-dashboard.tsx`
- `apps/web/components/config-editor.tsx`
- `apps/web/components/audit-log-viewer.tsx`
- `apps/web/components/health-dashboard.tsx`
- `apps/web/components/user-manager.tsx`
- `apps/web/app/admin/page.tsx`

**API Integration:**

- Config API (GET, PATCH)
- Audit API (GET with filters)
- Health API (GET /health)
- User API (admin operations)

---

### 4. Advanced Dictionary Management (Days 12-15) 📚

**Priority:** MEDIUM - Enhanced dictionary functionality

**Requirements:**

- Dictionary combination (merge multiple wordlists)
- Dictionary validation (remove duplicates, invalid entries)
- Dictionary statistics (word count, size, entropy)
- Advanced dictionary generation (rules, masks)

**Implementation:**

1. Create DictionaryGeneratorService
2. Add dictionary combination endpoint
3. Add dictionary validation endpoint
4. Add dictionary statistics endpoint
5. Advanced generation with hashcat rules
6. Mask-based dictionary generation

**API Endpoints:**

- `POST /api/dictionaries/:id/combine` - Combine with another dictionary
- `POST /api/dictionaries/validate` - Validate dictionary
- `GET /api/dictionaries/:id/stats` - Get dictionary statistics
- `POST /api/dictionaries/generate-advanced` - Advanced generation
- `POST /api/dictionaries/generate-mask` - Mask-based generation

**Dictionary Generation Features:**

- Rule-based generation (hashcat rules)
- Mask patterns (?a?d?s, etc.)
- Combination mode (dict + mask)
- Markov chain generation
- PRINCE algorithm
- Combinator mode (dict1 + dict2)

**Files to Create:**

- `apps/api/src/services/dictionary-generator.service.ts`
- `apps/api/src/services/dictionary-validator.service.ts`
- Update `apps/api/src/routes/dictionaries.ts`
- UI components in `apps/web/`

---

### 5. Capture Management UI (Days 16-17) 📡

**Priority:** MEDIUM - UI for captures service

**Requirements:**

- Capture list with filtering
- Capture details view
- Create job from capture
- Capture status indicators
- Bulk operations

**Implementation:**

1. Capture list page with search/filter
2. Capture detail modal
3. "Create Job" button from capture
4. Status badges and progress indicators
5. Bulk delete/archive operations

**UI Components to Create:**

- `apps/web/components/capture-list.tsx`
- `apps/web/components/capture-detail.tsx`
- `apps/web/components/create-job-from-capture.tsx`
- `apps/web/app/captures/page.tsx`

---

### 6. Testing & Documentation (Days 18-21) 🧪

**Priority:** HIGH - Quality assurance

**Requirements:**

- Unit tests for all new services
- Integration tests for new endpoints
- E2E tests for UI workflows
- Updated API documentation
- Phase 2 final report

**Testing Coverage:**

- EmailService unit tests
- Email worker tests
- Job management integration tests
- Dictionary generation/validator tests
- UI component tests (Playwright)

**Documentation:**

- Email configuration guide
- Job management guide
- Dictionary generation guide
- Updated API documentation
- Phase 2 completion report

---

## Dependencies & Prerequisites

### Required Infrastructure

- SMTP server or email service (SendGrid, Mailgun, AWS SES)
- Redis queues for email worker
- Database migrations applied

### Existing Services Used

- ConfigService (email configuration)
- AuditService (log email events)
- JobsService (job scheduling)
- CapturesService (capture management)
- HealthCheckService (health monitoring)

### External Dependencies

- `nodemailer` - Email sending
- `handlebars` - Email templates
- `hashcat-rule-engine` - Advanced dictionary generation (optional)

---

## Technical Considerations

### Email Queue

- Use BullMQ for async email sending
- Retry logic for failed emails
- Rate limiting to avoid spam filters
- Email batching for bulk operations

### Job Scheduling

- Use BullMQ delayed jobs
- Check dependencies before execution
- Handle circular dependencies
- Store execution history

### Dictionary Performance

- Stream processing for large wordlists
- Duplicate removal using efficient algorithms
- Async validation operations
- Progress reporting for long operations

### UI Real-time Updates

- Start with polling (simpler)
- WebSocket planned for Phase 3
- Optimistic UI updates
- Error handling and retry logic

---

## Success Criteria

### Feature Completion

- [ ] Email notifications working for all event types
- [ ] Jobs can be cancelled and rescheduled
- [ ] Admin dashboard with config, audit, health views
- [ ] Dictionary combination and validation working
- [ ] Capture management UI functional

### Quality Metrics

- [ ] 80%+ test coverage for new code
- [ ] All new UI components responsive
- [ ] Email templates tested in multiple clients
- [ ] Performance benchmarks met
- [ ] Security audit passed

### User Experience

- [ ] Clear error messages
- [ ] Loading states for long operations
- [ ] Confirmation dialogs for destructive actions
- [ ] Keyboard shortcuts in admin UI
- [ ] Mobile-responsive design

---

## Rollout Plan

### Day 1-3: Email Notifications

- Backend service and worker
- Email templates
- Integration with Better Auth
- Test with real SMTP server

### Day 4-8: Advanced Job Management

- Database migrations
- Backend API endpoints
- Job worker updates
- UI components
- Testing

### Day 9-11: Admin Dashboard

- Admin layout
- Config, audit, health components
- User management
- Integration testing

### Day 12-15: Advanced Dictionary Management

- Dictionary generation service
- Validation service
- API endpoints
- UI components
- Performance testing

### Day 16-17: Capture Management UI

- Capture list and details
- Job creation flow
- Testing

### Day 18-21: Testing & Documentation

- Complete test suite
- API documentation
- User guides
- Phase 2 final report
- Deployment preparation

---

## Known Risks & Mitigations

### Email Deliverability

**Risk:** Emails marked as spam or blocked
**Mitigation:**

- SPF, DKIM, DMARC records
- Use reputable SMTP service
- Monitor bounce rates
- Implement unsubscribe mechanism

### Job Scheduling Complexity

**Risk:** Dependencies create circular references
**Mitigation:**

- Validate dependencies before scheduling
- Detect and reject circular references
- Provide clear error messages
- Visual dependency graph in UI

### Dictionary Performance

**Risk:** Large dictionary operations time out
**Mitigation:**

- Stream processing
- Progress reporting
- Background jobs with status updates
- Timeout configuration

### UI Complexity

**Risk:** Admin dashboard becomes cluttered
**Mitigation:**

- Modular component design
- Progressive disclosure
- Search and filtering
- Responsive layout

---

## Next Steps

1. ✅ Review and approve this plan
2. ✅ Set up email service account (SMTP)
3. ✅ Begin Day 1: Email Notifications System
4. ✅ Create Phase 2 progress tracking document

---

**Status:** Ready to begin Phase 2 implementation
