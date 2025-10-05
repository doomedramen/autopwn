# Changelog

All notable changes to AutoPWN will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Custom wordlist generator with pattern support
- Job priority management (Low, Normal, High, Urgent)
- Pause/resume functionality for jobs
- Search and filter in job queue
- Job logs viewer
- Retry button for failed jobs
- Web-based file upload with drag-and-drop
- Potfile integration for instant password retrieval
- Real-time dashboard updates (2-3 second polling)

### Changed
- Upgraded to Next.js 15 and React 19
- Upgraded to Node.js 24 and better-sqlite3 v11
- Improved database schema with priority and paused fields
- Enhanced UI with better status indicators

### Fixed
- Fixed hashcat potfile password extraction
- Fixed React 19 compatibility issues
- Corrected database file path handling

## [1.0.0] - 2025-01-05

### Added
- Initial release
- Automated PCAP file processing
- Sequential dictionary attacks
- Multi-GPU support (NVIDIA, AMD, Intel, CPU)
- Next.js web dashboard
- SQLite database with WAL mode
- Job queue management
- Results tracking
- Real-time progress monitoring
- Docker Compose deployment
- Monorepo structure with npm workspaces

### Core Features
- File watcher with chokidar
- PCAP to hc22000 conversion using hcxpcapngtool
- Hashcat integration
- Job status tracking
- Statistics dashboard
- Results table with ESSID and passwords

### Documentation
- Comprehensive README with setup instructions
- Docker deployment guides for multiple GPU types
- Development setup documentation
- Security notice and usage guidelines

[Unreleased]: https://github.com/DoomedRamen/autopwn/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/DoomedRamen/autopwn/releases/tag/v1.0.0
