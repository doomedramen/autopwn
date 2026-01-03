# AutoPWN Documentation

Complete documentation for the AutoPWN security testing platform.

## 📚 Documentation Index

### Getting Started

- **[QUICKSTART](QUICKSTART.md)** - Get running in 5 minutes
- **[SETUP](SETUP.md)** - Initial setup and installation guide
- **[DEVELOPMENT](DEVELOPMENT.md)** - Development environment and workflow

### Architecture & Design

- **[ARCHITECTURE](ARCHITECTURE.md)** - System architecture and component overview
- **[DATABASE](DATABASE.md)** - Database schema and design
- **[API](API.md)** - API endpoints and usage
- **[BETTER_AUTH_SCHEMA](BETTER_AUTH_SCHEMA.md)** - Authentication system schema

### Deployment

- **[DEPLOYMENT](DEPLOYMENT.md)** - General deployment guide
- **[DOCKER_DEPLOYMENT](DOCKER_DEPLOYMENT.md)** - Docker deployment (dev, test, prod)
- **[DOCKER_FILES_OVERVIEW](DOCKER_FILES_OVERVIEW.md)** - Docker Compose files explained
- **[REDIS_CONFIGURATION](REDIS_CONFIGURATION.md)** - Redis setup and security

### Testing

- **[TESTING](TESTING.md)** - Testing overview and strategy
- **[NEW_TESTING_GUIDE](NEW_TESTING_GUIDE.md)** - Modern testing infrastructure
- **[TEST_COVERAGE](TEST_COVERAGE.md)** - Coverage requirements and best practices

### Features & Configuration

- **[EMAIL_VERIFICATION](EMAIL_VERIFICATION.md)** - Email verification setup (SMTP, Mailhog)

### Planning & Roadmap

- **[PROJECT_PLAN](PROJECT_PLAN.md)** - Project planning and milestones
- **[ROADMAP](ROADMAP.md)** - Feature roadmap and future plans

## 🚀 Quick Links

### For Developers

Start here if you're new to the project:

1. [QUICKSTART.md](QUICKSTART.md) - Get running in 5 minutes
2. [SETUP.md](SETUP.md) - Get your development environment running
3. [DEVELOPMENT.md](DEVELOPMENT.md) - Learn the development workflow
4. [TESTING.md](TESTING.md) - Run and write tests
5. [DOCKER_FILES_OVERVIEW.md](DOCKER_FILES_OVERVIEW.md) - Understand Docker setup

### For DevOps/Deployment

Deploying to production:

1. [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Complete deployment guide
2. [REDIS_CONFIGURATION.md](REDIS_CONFIGURATION.md) - Redis security hardening
3. [EMAIL_VERIFICATION.md](EMAIL_VERIFICATION.md) - Configure email service

### For Contributors

Contributing to the project:

1. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the system design
2. [DATABASE.md](DATABASE.md) - Database schema and migrations
3. [API.md](API.md) - API structure and conventions
4. [TEST_COVERAGE.md](TEST_COVERAGE.md) - Testing requirements

## 📖 Documentation Categories

### Setup & Installation
- Initial setup steps
- Dependencies and requirements
- Environment configuration
- Database initialization

### Development
- Local development workflow
- Hot reload setup
- Debugging tips
- Code style and conventions

### Architecture
- System components
- Data flow
- Security design
- Technology stack

### Testing
- Unit testing
- Integration testing
- E2E testing
- Test coverage requirements
- CI/CD integration

### Deployment
- Docker environments (dev, test, staging, prod)
- Environment variables
- Security hardening
- Monitoring and logging
- Backup and recovery

### Configuration
- Redis configuration
- Database tuning
- Email setup
- Authentication configuration

## 🔍 Finding Information

### By Topic

| Topic | Documentation |
|-------|---------------|
| **Getting Started** | [QUICKSTART.md](QUICKSTART.md), [SETUP.md](SETUP.md), [DEVELOPMENT.md](DEVELOPMENT.md) |
| **Docker** | [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md), [DOCKER_FILES_OVERVIEW.md](DOCKER_FILES_OVERVIEW.md) |
| **Testing** | [TESTING.md](TESTING.md), [TEST_COVERAGE.md](TEST_COVERAGE.md), [NEW_TESTING_GUIDE.md](NEW_TESTING_GUIDE.md) |
| **Database** | [DATABASE.md](DATABASE.md), [BETTER_AUTH_SCHEMA.md](BETTER_AUTH_SCHEMA.md) |
| **Security** | [REDIS_CONFIGURATION.md](REDIS_CONFIGURATION.md), [EMAIL_VERIFICATION.md](EMAIL_VERIFICATION.md) |
| **API** | [API.md](API.md) |
| **Deployment** | [DEPLOYMENT.md](DEPLOYMENT.md), [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) |

### By Task

| I want to... | Read this |
|--------------|-----------|
| Get running quickly | [QUICKSTART.md](QUICKSTART.md) |
| Set up my development environment | [SETUP.md](SETUP.md) |
| Run the application locally | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Run tests | [TESTING.md](TESTING.md) |
| Deploy to production | [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) |
| Configure Redis | [REDIS_CONFIGURATION.md](REDIS_CONFIGURATION.md) |
| Set up email verification | [EMAIL_VERIFICATION.md](EMAIL_VERIFICATION.md) |
| Understand the architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Work with the database | [DATABASE.md](DATABASE.md) |
| Understand Docker setup | [DOCKER_FILES_OVERVIEW.md](DOCKER_FILES_OVERVIEW.md) |

## 📝 Documentation Standards

All documentation in this project follows these standards:

1. **Clear Structure** - Each document has a table of contents and clear sections
2. **Code Examples** - Practical examples for all commands and configurations
3. **Version Control** - Docs include "Last Updated" date at the bottom
4. **Cross-References** - Links between related documentation
5. **Troubleshooting** - Common issues and solutions included where applicable

## 🔄 Keeping Documentation Updated

When making changes to the project:

1. **Update relevant docs** - If you change functionality, update the documentation
2. **Check cross-references** - Ensure links still work
3. **Update dates** - Change the "Last Updated" date at the bottom of modified docs
4. **Test examples** - Verify code examples still work

## 📁 Archive

Older or superseded documentation is kept in `docs/archive/` for historical reference.

## 🆘 Getting Help

If you can't find what you're looking for:

1. Check the [README](../README.md) in the project root
2. Search all documentation: `grep -r "your search term" docs/`
3. Check the [TROUBLESHOOTING](../TROUBLESHOOTING.md) guide
4. Ask in project discussions or issues

---

**Last Updated:** 2026-01-03
**Total Documentation Files:** 18
