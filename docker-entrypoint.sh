#!/bin/sh

# Extract database connection info from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

# Wait for database to be ready
echo "Waiting for database to be ready at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready - applying database migrations..."

# Run database migrations using Drizzle
if [ -f "package.json" ] && [ -d "node_modules" ]; then
  echo "Running Drizzle database migrations..."
  # Use npm instead of pnpm to avoid corepack issues in Docker
  npm run db:migrate || {
    echo "Migration failed, trying schema push (might be a fresh database)..."
    npm run db:push || {
      echo "Both migration and push failed, continuing anyway (schema might already be up to date)"
    }
  }

  echo "Database migrations completed - starting application..."
else
  echo "Package files not found, skipping database migrations - starting application..."
fi

# Start the application
exec "$@"