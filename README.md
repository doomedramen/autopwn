# AutoPWN

A powerful security analysis tool for network penetration testing and vulnerability assessment.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** package manager
- **PostgreSQL** 15+ (for local development)
- **Docker** & **Docker Compose** (optional, for containerized deployment)

### Option 1: Docker Deployment (Recommended)

1. **Clone and setup:**

   ```bash
   git clone <repository-url>
   cd autopwn
   cp .env.docker.example .env
   ```

2. **Configure environment:**

   ```bash
   # Edit .env with your configuration
   nano .env
   ```

   **Required changes:**
   - `BETTER_AUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `POSTGRES_PASSWORD`: Change from default
   - `APP_URL`: Update to your domain/IP

3. **Start with Docker Compose:**

   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - URL: `http://localhost:3000`
   - Initial superuser credentials will be displayed in the container logs

### Option 2: Local Development

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Setup environment:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database and auth configuration
   ```

3. **Setup PostgreSQL database:**

   ```bash
   # Create database
   createdb autopwn

   # Run migrations
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

## 📁 Environment Configuration

### Required Environment Variables

| Variable              | Description                       | Default                 |
| --------------------- | --------------------------------- | ----------------------- |
| `DATABASE_URL`        | PostgreSQL connection string      | `postgresql://...`      |
| `BETTER_AUTH_SECRET`  | Authentication secret (32+ chars) | **Required**            |
| `BETTER_AUTH_URL`     | Base URL for auth callbacks       | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public application URL            | `http://localhost:3000` |

### Optional Security Configuration

| Variable                     | Description                          | Default |
| ---------------------------- | ------------------------------------ | ------- |
| `MIN_PASSWORD_LENGTH`        | Minimum password length              | `8`     |
| `REQUIRE_PASSWORD_UPPERCASE` | Require uppercase in passwords       | `true`  |
| `REQUIRE_PASSWORD_LOWERCASE` | Require lowercase in passwords       | `true`  |
| `REQUIRE_PASSWORD_NUMBERS`   | Require numbers in passwords         | `true`  |
| `REQUIRE_PASSWORD_SYMBOLS`   | Require symbols in passwords         | `true`  |
| `ACCOUNT_LOCKOUT_ATTEMPTS`   | Failed login attempts before lockout | `5`     |
| `ACCOUNT_LOCKOUT_DURATION`   | Lockout duration in minutes          | `15`    |
| `SESSION_TIMEOUT`            | Session timeout in hours             | `24`    |

### Testing/Development Variables

| Variable       | Description                        | Usage                      |
| -------------- | ---------------------------------- | -------------------------- |
| `DISABLE_AUTH` | Disable authentication for testing | `true`/`false`             |
| `NODE_ENV`     | Environment mode                   | `development`/`production` |

## 🗄️ Database Management

### Migrations

```bash
# Generate new migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema changes (development only)
pnpm db:push

# Open database studio
pnpm db:studio
```

### Database Reset

```bash
# Reset database (DESTRUCTIVE)
pnpm db:reset
```

## 🐳 Docker Deployment

### Building Custom Image

```bash
# Build image
docker build -t autopwn:latest .

# Run with custom configuration
docker run -d \
  --name autopwn \
  -p 3000:3000 \
  --env-file .env \
  autopwn:latest
```

### Docker Compose with External Database

```bash
# Use external PostgreSQL
# Update docker-compose.yml to remove postgres service
# Set DATABASE_URL to your external database
docker-compose up -d
```

## 🔧 Development

### Available Scripts

| Script                  | Description                             |
| ----------------------- | --------------------------------------- |
| `pnpm dev`              | Start development server with Turbopack |
| `pnpm build`            | Build for production                    |
| `pnpm start`            | Start production server                 |
| `pnpm lint`             | Run ESLint                              |
| `pnpm lint:fix`         | Fix ESLint issues                       |
| `pnpm format:check`     | Check Prettier formatting               |
| `pnpm format:write`     | Apply Prettier formatting               |
| `pnpm tsc`              | Type checking                           |
| `pnpm test`             | Run integration tests                   |
| `pnpm test:e2e`         | Run end-to-end tests                    |
| `pnpm test:integration` | Run integration tests only              |

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:coverage
```

## 🔐 Initial Setup

### First Login

1. After starting the application, the initial superuser account is created automatically
2. Check the container logs or console output for initial credentials:

   ```
   🔐 Initial Superuser Created:
      Email: superuser@autopwn.local
      Password: TestPassword123!
      Username: superuser
   ⚠️  Please change these credentials after first login!
   ```

3. **Important**: Change the default password immediately after first login

### Creating Additional Users

Only superusers and admins can create additional user accounts:

1. Log in as superuser/admin
2. Navigate to User Management
3. Create new users with appropriate roles

## 🚨 Security Notes

### Production Deployment Checklist

- [ ] Change `BETTER_AUTH_SECRET` to a secure random value
- [ ] Update default PostgreSQL password
- [ ] Change default superuser credentials
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate password policies
- [ ] Enable HTTPS (reverse proxy recommended)
- [ ] Regularly update dependencies
- [ ] Monitor security advisories

### Security Features

- Password complexity requirements
- Account lockout protection
- Session management
- Role-based access control (superuser, admin, user)
- Secure password hashing (bcrypt)

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify DATABASE_URL format
echo $DATABASE_URL
```

**Build Errors**

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Authentication Issues**

```bash
# Check auth configuration
grep BETTER_AUTH .env

# Restart application after config changes
docker-compose restart
```

**Permission Issues**

```bash
# Fix file permissions for volumes
sudo chown -R 1001:1001 uploads/ jobs/
```

### Logs

```bash
# Docker logs
docker-compose logs -f app
docker-compose logs -f postgres

# Development logs
pnpm dev
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Documentation](https://better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs)
- [Docker Documentation](https://docs.docker.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

[License information here]

---

**⚠️ Important**: This tool is designed for authorized security testing and educational purposes only. Users are responsible for ensuring they have proper authorization before testing any systems.
test change
