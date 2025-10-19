#!/bin/sh

# Extract database connection info from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

# URL-encode the password if needed
if echo "$DATABASE_URL" | grep -q "[/+=%]"; then
  echo "URL encoding database password to handle special characters..."
  # Extract and URL-encode the password
  DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
  ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent('$DB_PASSWORD'))")
  DATABASE_URL="postgresql://$DB_USER:$ENCODED_PASSWORD@$DB_HOST:$DB_PORT/autopwn"
  export DATABASE_URL
  echo "Database URL updated with URL-encoded password"
fi

# Wait for database to be ready
echo "Waiting for database to be ready at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready - setting up directory permissions..."

# Ensure uploads and jobs directories have correct ownership
echo "Setting ownership for uploads and jobs directories..."
mkdir -p /app/uploads/pcap /app/uploads/dictionary /app/uploads/general /app/jobs
chown -R nextjs:users /app/uploads /app/jobs
chmod -R 755 /app/uploads /app/jobs 2>/dev/null || true

echo "Directory permissions setup complete - validating required tools..."

# Validate required tools are available (basic validation)
echo "Validating required tools..."
if command -v hashcat >/dev/null 2>&1 && command -v hcxpcapngtool >/dev/null 2>&1; then
  echo "✅ Required tools (hashcat, hcxpcapngtool) are available!"
else
  echo "⚠️  Some required tools may be missing - continuing with startup..."
  echo "This may indicate a build issue. Please check your Docker image."
fi

echo "Tool validation complete - applying database migrations..."

# Run database migrations using Drizzle
if [ -f "package.json" ] && [ -d "node_modules" ]; then
  echo "Running database migrations..."

  # Check if migrations directory exists and has files
  if [ -d "src/lib/db/migrations" ] && [ "$(ls -A src/lib/db/migrations/*.sql 2>/dev/null)" ]; then
    echo "Found existing migration files, applying them to database..."
    # Use drizzle-kit migrate to apply generated migration files
    if npx drizzle-kit migrate 2>&1 | tee /tmp/db-migrate.log; then
      echo "✅ Database migrations completed successfully"
    else
      echo "❌ Database migrations failed!"
      echo "Last 20 lines of output:"
      tail -20 /tmp/db-migrate.log
      echo ""
      echo "Checking if tables already exist..."
      # Try to query a basic table to see if schema exists
      if node -e "const { db } = require('./dist/lib/db/index.js'); db.query.users.findFirst().then(() => { console.log('Schema appears to exist'); process.exit(0); }).catch(() => { console.log('Schema does not exist'); process.exit(1); });" 2>/dev/null; then
        echo "✅ Database schema appears to already exist - continuing..."
      else
        echo "❌ CRITICAL: Database schema does not exist and migrations failed!"
        echo "Cannot start application without database schema."
        echo "Please check your DATABASE_URL and database permissions."
        exit 1
      fi
    fi
  else
    echo "No migration files found. You need to generate them first:"
    echo "  Run: npm run db:generate"
    echo "  Or: npx drizzle-kit generate"
    echo ""
    echo "Checking if tables already exist..."
    # Try to query a basic table to see if schema exists
    if node -e "const { db } = require('./dist/lib/db/index.js'); db.query.users.findFirst().then(() => { console.log('Schema appears to exist'); process.exit(0); }).catch(() => { console.log('Schema does not exist'); process.exit(1); });" 2>/dev/null; then
      echo "✅ Database schema appears to already exist - continuing..."
    else
      echo "❌ CRITICAL: No migration files found and no existing schema!"
      echo "Cannot start application without database schema."
      echo "Please generate migration files first using: npm run db:generate"
      exit 1
    fi
  fi

  echo "Database setup completed - starting application..."
else
  echo "⚠️  Package files not found, skipping database migrations - starting application..."
fi

# Start the application
exec "$@"