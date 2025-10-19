# Roadmap

Future plans and feature development for autopwn.

## Current Version: v0.1.0 (Planning)

This document outlines the planned features and improvements for autopwn.

## Release Timeline

### Phase 1: MVP (v0.1.0 - v0.3.0) - Q1 2025

**Goal:** Core functionality for personal use

- ✅ Project documentation
- ⬜ Basic authentication (email/password, superuser/admin/user roles)
- ⬜ PCAP upload and storage
- ⬜ PCAP to hc22000 conversion (hcxpcapngtool)
- ⬜ Network extraction and deduplication
- ⬜ Dictionary upload
- ⬜ Basic dictionary generation (keywords + variations)
- ⬜ Hashcat job creation and execution
- ⬜ Job queue management (BullMQ)
- ⬜ Results storage and display
- ⬜ Basic dashboard UI
- ⬜ Docker deployment

### Phase 2: Production Ready (v0.4.0 - v1.0.0) - Q2 2025

**Goal:** Stable, secure, and scalable for small teams

- ⬜ Comprehensive testing (unit, integration, e2e)
- ⬜ Security hardening
- ⬜ Performance optimization
- ⬜ Automated backups
- ⬜ Database migrations
- ⬜ Error handling and logging
- ⬜ Rate limiting and DDoS protection
- ⬜ Production deployment guide
- ⬜ CI/CD pipeline
- ⬜ API documentation (OpenAPI/Swagger)

### Phase 3: Advanced Features (v1.1.0 - v2.0.0) - Q3-Q4 2025

**Goal:** Enhanced functionality and user experience

- ⬜ GPU support for hashcat
- ⬜ S3-compatible object storage
- ⬜ Advanced hashcat attack modes
- ⬜ Real-time job progress (WebSocket)
- ⬜ Statistics and analytics dashboard
- ⬜ Bulk PCAP upload
- ⬜ Advanced dictionary generation (rules, masks)
- ⬜ Job scheduling and automation
- ⬜ Webhook notifications
- ⬜ API key authentication

### Phase 4: Enterprise Features (v2.1.0+) - 2026

**Goal:** Large-scale deployments and advanced capabilities

- ⬜ Multi-node distributed processing
- ⬜ Kubernetes deployment
- ⬜ SSO/LDAP integration
- ⬜ Advanced RBAC and team management
- ⬜ Audit logging and compliance
- ⬜ Custom branding
- ⬜ Marketplace for wordlists/rules
- ⬜ Machine learning for password prediction

## Feature Details

### 🔐 Authentication & Authorization

**Current:**
- Email/password authentication
- Three roles: User, Admin, Superuser
- Session-based auth

**Planned:**

**v0.5.0 - Enhanced Auth:**
- [ ] Password reset via email
- [ ] Email verification
- [ ] Two-factor authentication (TOTP)
- [ ] Account lockout after failed attempts
- [ ] Session management (view/revoke active sessions)

**v0.8.0 - API Key Authentication:**
- [ ] API key generation in web interface
- [ ] API key management (create, revoke, list)
- [ ] API key scopes/permissions
- [ ] API endpoint for PCAP upload with API key auth
- [ ] Pwnagotchi auto-upload plugin (Python script)

**v1.5.0 - Enterprise Auth:**
- [ ] SSO (SAML, OAuth)
- [ ] LDAP/Active Directory integration
- [ ] Fine-grained permissions (custom roles)

---

### 📁 File Management

**Current:**
- Local filesystem storage
- PCAP and dictionary uploads
- Basic file size limits

**Planned:**

**v0.6.0 - S3 Storage:**
- [ ] S3-compatible object storage (AWS S3, MinIO, etc.)
- [ ] Configurable storage backend (local or S3)
- [ ] Automatic migration between storage backends
- [ ] Pre-signed URLs for downloads

**v1.2.0 - Advanced File Management:**
- [ ] Bulk PCAP upload (zip archives)
- [ ] Folder organization
- [ ] File tagging and search
- [ ] Automatic cleanup of old files
- [ ] Storage usage quotas per user
- [ ] Compression for storage efficiency

---

### 🤖 Pwnagotchi Integration

**Current:**
- Manual PCAP upload via web interface

**Planned:**

**v0.8.0 - Auto-Upload Plugin:**
- [ ] API key authentication system
- [ ] API endpoint for programmatic PCAP upload
- [ ] Python plugin for Pwnagotchi auto-upload
- [ ] Plugin configuration (URL, API key)
- [ ] Automatic upload when WiFi available
- [ ] Upload retry on failure
- [ ] Upload status notifications
- [ ] Batch upload support

**v1.3.0 - Enhanced Integration:**
- [ ] Pwnagotchi device registration
- [ ] Device-specific statistics
- [ ] Remote job triggering from web interface
- [ ] Job result notifications to Pwnagotchi
- [ ] Device health monitoring
- [ ] Multiple device support per user

**Why This Matters:**

The Pwnagotchi auto-upload plugin eliminates manual file transfer, creating a seamless workflow:
1. Pwnagotchi captures handshakes in the field
2. When WiFi is available, automatically uploads to autopwn
3. User receives notification of new captures
4. User can immediately create cracking jobs from web interface
5. Results available without any manual file handling

**Implementation Details:**

**API Endpoint:**
```
POST /api/v1/captures/upload-via-api
Authorization: Bearer <api-key>
Content-Type: multipart/form-data

{
  "file": <pcap-file>,
  "device_id": "pwnagotchi-01" (optional),
  "metadata": {
    "captured_at": "2025-01-19T12:00:00Z",
    "location": "lat,lng" (optional)
  }
}
```

**Python Plugin:**
Location: `apps/pwnagotchi-plugin/autopwn_uploader.py`

Features:
- Single-file Python script
- Configurable URL and API key
- Automatic PCAP detection
- Upload queue for reliability
- Retry logic with exponential backoff
- Progress feedback
- Minimal dependencies (requests library only)

**User Workflow:**
1. Generate API key in autopwn web interface
2. Install plugin on Pwnagotchi
3. Configure plugin with autopwn URL and API key
4. Plugin auto-uploads new handshakes when online

---

### 🔨 Hashcat Integration

**Current:**
- CPU-only hashcat
- Straight attack mode
- Basic workload profiles
- Sequential job execution

**Planned:**

**v0.7.0 - GPU Support:**
- [ ] NVIDIA GPU support (CUDA)
- [ ] AMD GPU support (OpenCL)
- [ ] GPU device selection
- [ ] Mixed CPU/GPU jobs
- [ ] GPU-optimized Docker images

**v1.0.0 - Attack Modes:**
- [ ] Combinator attack
- [ ] Mask attack (brute force)
- [ ] Hybrid attack (dict + mask)
- [ ] Rule-based attack
- [ ] Prince attack
- [ ] Custom hashcat commands

**v1.3.0 - Advanced Features:**
- [ ] Job templates (save/reuse configurations)
- [ ] Hashcat session resume (checkpoint recovery)
- [ ] Priority queue for jobs
- [ ] Scheduled jobs (cron-like)
- [ ] Job dependencies (run job B after job A)
- [ ] Distributed hashcat (multiple nodes)

---

### 📚 Dictionary Generation

**Current:**
- Keyword-based generation
- Case variations
- Leet speak
- Special character padding

**Planned:**

**v0.8.0 - Advanced Generation:**
- [ ] Hashcat rules engine
- [ ] Custom rule creation UI
- [ ] Markov chain generation
- [ ] Pattern-based generation (masks)
- [ ] Date/year combinations
- [ ] Keyboard walk patterns
- [ ] PRINCE algorithm
- [ ] Combinator dictionary generation

**v1.4.0 - Smart Generation:**
- [ ] Machine learning for password prediction
- [ ] OSINT-based wordlist generation (from username, location, etc.)
- [ ] Common pattern detection from cracked passwords
- [ ] Dictionary optimization (remove tested passwords)

---

### 📊 Dashboard & UI

**Current:**
- Basic capture/job/dictionary lists
- Job creation form
- Results display

**Planned:**

**v0.9.0 - Enhanced Dashboard:**
- [ ] Real-time statistics
- [ ] Job progress with live updates (WebSocket)
- [ ] Charts and graphs (success rate, crack time, etc.)
- [ ] Activity timeline
- [ ] Quick actions panel
- [ ] Dark mode

**v1.6.0 - Analytics:**
- [ ] Advanced reporting
- [ ] Export reports (PDF, CSV)
- [ ] Password strength analysis
- [ ] Common pattern identification
- [ ] Time-based analytics (cracking trends)
- [ ] User activity tracking

**v2.0.0 - Collaboration:**
- [ ] Team workspaces
- [ ] Shared captures/dictionaries
- [ ] Comments and annotations
- [ ] Real-time collaboration
- [ ] Activity feed

---

### 🔔 Notifications

**Planned:**

**v1.1.0 - Basic Notifications:**
- [ ] Email notifications (job complete, failure)
- [ ] In-app notifications
- [ ] Notification preferences

**v1.7.0 - Advanced Notifications:**
- [ ] Webhook integration
- [ ] Slack/Discord integration
- [ ] SMS notifications (Twilio)
- [ ] Push notifications (PWA)
- [ ] Notification rules (only notify on success, etc.)

---

### 🚀 Performance & Scalability

**Planned:**

**v1.0.0 - Optimization:**
- [ ] Database query optimization
- [ ] Caching layer (Redis)
- [ ] Connection pooling
- [ ] Lazy loading and pagination
- [ ] Background job optimization

**v2.2.0 - Horizontal Scaling:**
- [ ] Load-balanced API servers
- [ ] Multiple worker nodes
- [ ] Distributed job queue
- [ ] Database replication
- [ ] Kubernetes deployment manifests
- [ ] Auto-scaling based on queue length

---

### 🔒 Security

**Planned:**

**v0.5.0 - Basic Security:**
- [ ] Rate limiting per endpoint
- [ ] CAPTCHA for login
- [ ] IP-based access control
- [ ] Audit logging

**v1.8.0 - Advanced Security:**
- [ ] Encrypted storage for results
- [ ] File scanning (antivirus, malware detection)
- [ ] Content Security Policy (CSP)
- [ ] Subresource Integrity (SRI)
- [ ] Security headers
- [ ] Penetration testing
- [ ] Bug bounty program
- [ ] Compliance (GDPR, SOC2)

---

### 🛠️ Developer Experience

**Planned:**

**v0.4.0 - API & SDK:**
- [ ] OpenAPI/Swagger documentation
- [ ] REST API stability guarantee
- [ ] CLI tool for autopwn
- [ ] Python SDK
- [ ] JavaScript/TypeScript SDK

**v1.9.0 - Extensibility:**
- [ ] Plugin system
- [ ] Custom hashcat modes
- [ ] Webhook for custom workflows
- [ ] GraphQL API (alternative to REST)
- [ ] Event streaming (Kafka/RabbitMQ)

---

### 📦 Deployment & DevOps

**Planned:**

**v0.3.0 - Docker:**
- [ ] Multi-arch Docker images (amd64, arm64)
- [ ] Docker Hub releases
- [ ] GitHub Container Registry

**v1.0.0 - CI/CD:**
- [ ] GitHub Actions pipeline
- [ ] Automated testing
- [ ] Automated releases
- [ ] Changelog generation
- [ ] Semantic versioning

**v2.3.0 - Advanced Deployment:**
- [ ] Helm charts for Kubernetes
- [ ] Terraform modules
- [ ] Ansible playbooks
- [ ] One-click cloud deployments (AWS, GCP, Azure)
- [ ] DigitalOcean marketplace image

---

### 🌍 Internationalization

**Planned:**

**v2.4.0 - i18n:**
- [ ] Multi-language support
- [ ] Translations (English, Spanish, French, German, etc.)
- [ ] RTL language support
- [ ] Locale-based formatting

---

### 📱 Mobile & PWA

**Planned:**

**v2.5.0 - Progressive Web App:**
- [ ] PWA support (installable)
- [ ] Offline capabilities
- [ ] Push notifications
- [ ] Mobile-optimized UI

**v3.0.0 - Native Mobile:**
- [ ] React Native mobile app
- [ ] iOS and Android support
- [ ] Mobile-specific features (photo upload of QR codes, etc.)

---

## Community Requests

Features requested by the community will be prioritized and added here.

**How to request features:**
1. Open a [GitHub Issue](https://github.com/yourusername/autopwn/issues)
2. Use the "Feature Request" template
3. Describe the use case and expected behavior
4. Upvote existing requests you'd like to see

**Top Community Requests:**
- *None yet - be the first!*

---

## Known Limitations

### Current Limitations (MVP)

1. **CPU-only hashcat:** GPU support not yet implemented
2. **Local storage only:** S3 support planned for v0.6.0
3. **Single attack mode:** Only straight attack currently supported
4. **No real-time updates:** Job progress requires polling
5. **No bulk uploads:** One file at a time
6. **Basic dictionary generation:** Limited options
7. **No job scheduling:** Jobs run immediately when queued

### Technical Debt

Items to address for long-term maintainability:

- [ ] Comprehensive test coverage (target: 80%+)
- [ ] Performance benchmarking suite
- [ ] Load testing and optimization
- [ ] Database migration strategy
- [ ] Backward compatibility policy
- [ ] Deprecation process

---

## Breaking Changes

We aim to minimize breaking changes, but some are necessary for progress.

**Upcoming Breaking Changes:**

**v2.0.0:**
- Database schema changes (migration provided)
- API endpoint restructuring (v1 deprecated, v2 introduced)
- Configuration file format changes

---

## How to Contribute

Want to help build these features?

1. Check the [DEVELOPMENT.md](./DEVELOPMENT.md) guide
2. Look for issues labeled `help wanted` or `good first issue`
3. Comment on the issue to claim it
4. Submit a PR when ready

---

## Version Support

**Release Schedule:**
- **Major versions (1.0, 2.0):** Every 12-18 months
- **Minor versions (1.1, 1.2):** Every 2-3 months
- **Patch versions (1.0.1, 1.0.2):** As needed for bug fixes

**Support Policy:**
- **Current major version:** Full support (features + bug fixes)
- **Previous major version:** Security fixes only (6 months after new major release)
- **Older versions:** No support (please upgrade)

---

## Feedback

Have suggestions for the roadmap?

- **GitHub Discussions:** [Share ideas](https://github.com/yourusername/autopwn/discussions)
- **GitHub Issues:** [Feature requests](https://github.com/yourusername/autopwn/issues)
- **Discord:** Join our community server (TBD)

---

**Last Updated:** January 19, 2025

This roadmap is subject to change based on community feedback, technical constraints, and project priorities.
