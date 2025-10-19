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

echo "Database is ready - setting up directory permissions..."

# Ensure uploads and jobs directories have correct ownership
echo "Setting ownership for uploads and jobs directories..."
mkdir -p /app/uploads/pcap /app/uploads/dictionary /app/uploads/general /app/jobs
chown -R nextjs:nodejs /app/uploads /app/jobs
chmod -R 755 /app/uploads /app/jobs

echo "Directory permissions setup complete - validating required tools..."

# Validate required tools are available
echo "Validating required tools..."
if [ -f "package.json" ] && [ -d "node_modules" ]; then
  # Run tool validation using Node.js
  node -e "
const { toolValidator } = require('./dist/lib/tool-validation.js');
async function validateTools() {
  try {
    const results = await toolValidator.checkRequiredTools();
    const missingCritical = results.filter(r => r.critical && !r.available);

    if (missingCritical.length > 0) {
      console.error('\\n❌ CRITICAL: Required tools are missing!');
      console.error('Missing tools:');
      missingCritical.forEach(tool => {
        console.error(\`  - \${tool.name}: \${tool.error || 'Unknown error'}\`);
      });
      console.error('\\nAutoPWN cannot start without these tools.');
      console.error('Please ensure you are using the correct Docker image with all tools installed.');
      console.error('Image should include both hashcat and hcxtools.');
      process.exit(1);
    }

    console.log('\\n✅ All required tools are available!');
    console.log('AutoPWN can start safely.');
  } catch (error) {
    console.error('❌ Tool validation failed:', error.message);
    console.error('Continuing with application startup...');
  }
}
validateTools();
  " || {
    echo "⚠️  Tool validation failed to run - continuing with startup..."
    echo "This may indicate a build issue. Please check your Docker image."
  }
else
  echo "⚠️  Package files not found - skipping tool validation"
fi

echo "Tool validation complete - applying database migrations..."

# Run database migrations using Drizzle
if [ -f "package.json" ] && [ -d "node_modules" ]; then
  echo "Running Drizzle database schema push..."
  # Use db:push instead of db:migrate for Docker - it's more reliable
  # db:push will sync the schema from TypeScript to the database
  if npm run db:push 2>&1 | tee /tmp/db-push.log; then
    echo "✅ Database schema synchronized successfully"
  else
    echo "❌ Database schema push failed!"
    echo "Last 20 lines of output:"
    tail -20 /tmp/db-push.log
    echo ""
    echo "Checking if tables already exist..."
    # Try to query a basic table to see if schema exists
    if node -e "const { db } = require('./dist/lib/db/index.js'); db.query.users.findFirst().then(() => { console.log('Schema appears to exist'); process.exit(0); }).catch(() => { console.log('Schema does not exist'); process.exit(1); });" 2>/dev/null; then
      echo "✅ Database schema appears to already exist - continuing..."
    else
      echo "❌ CRITICAL: Database schema does not exist and push failed!"
      echo "Cannot start application without database schema."
      echo "Please check your DATABASE_URL and database permissions."
      exit 1
    fi
  fi

  echo "Database setup completed - starting application..."
else
  echo "⚠️  Package files not found, skipping database migrations - starting application..."
fi

# Start the application
exec "$@"