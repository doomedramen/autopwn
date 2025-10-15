# Quick Docker Deployment

## 🚀 One-Command Setup

```bash
docker-compose up -d
```

That's it! The app will be available at http://localhost:3000

## What Happens
- PostgreSQL database starts automatically
- Application starts with correct database schema
- Database migrations run automatically
- Data persists between restarts

## First Time Setup
1. Open http://localhost:3000/setup
2. Create your admin account
3. Start using the application!

## Need to Stop?
```bash
docker-compose down
```

## Production Usage
Just change `BETTER_AUTH_SECRET` to a secure random string in the docker-compose.yml file.

**That's it - no complex configuration needed!** 🎉