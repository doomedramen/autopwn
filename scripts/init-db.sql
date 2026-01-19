-- ==============================================================================
-- CrackHouse Database Initialization Script
-- ==============================================================================
-- This script runs when PostgreSQL containers are first created via the
-- docker-entrypoint-initdb.d mechanism. It configures the database for
-- optimal performance and security for CrackHouse workloads.
--
-- IMPORTANT NOTES:
-- 1. This script runs BEFORE the server is fully started
-- 2. ALTER SYSTEM changes that require restart will be applied on next startup
-- 3. Settings incompatible with tmpfs (testing) are commented out
-- 4. For production, additional configuration should be done via postgresql.conf
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------------------------
-- Create PostgreSQL extensions required by CrackHouse

-- UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram indexing for fast text search (used for SSID/BSSID searches)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- BASIC CONFIGURATION
-- ------------------------------------------------------------------------------

-- Set timezone to UTC for consistency across all environments
SET timezone = 'UTC';

-- ------------------------------------------------------------------------------
-- QUERY PERFORMANCE MONITORING (pg_stat_statements)
-- ------------------------------------------------------------------------------
-- IMPORTANT: pg_stat_statements requires special handling
--
-- WHY COMMENTED OUT:
-- - Requires shared_preload_libraries to be set at server STARTUP
-- - Cannot be loaded via ALTER SYSTEM in init scripts
-- - Causes errors in tmpfs mode (testing) due to write restrictions
--
-- HOW TO ENABLE FOR PRODUCTION:
-- Option 1: Set environment variable in docker-compose.yml:
--   POSTGRES_SHARED_PRELOAD_LIBRARIES: 'pg_stat_statements'
--
-- Option 2: Mount custom postgresql.conf with:
--   shared_preload_libraries = 'pg_stat_statements'
--   track_activity_query_size = 2048
--   pg_stat_statements.track = 'all'
--
-- Option 3: Enable after server is running:
--   docker-compose exec database psql -U postgres -c "CREATE EXTENSION pg_stat_statements;"
--
-- COMMENTED OUT (see above for how to enable):
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET track_activity_query_size = 2048;
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- LOGGING CONFIGURATION
-- ------------------------------------------------------------------------------
-- Configure PostgreSQL logging for production debugging
-- Note: These settings apply after pg_reload_conf() or server restart

-- Don't log all statements (too verbose), only long-running ones
ALTER SYSTEM SET log_statement = 'none';

-- Log query execution duration
ALTER SYSTEM SET log_duration = on;

-- Log queries taking > 1 second (helps identify slow queries)
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- ------------------------------------------------------------------------------
-- PERFORMANCE TUNING
-- ------------------------------------------------------------------------------
-- These settings optimize PostgreSQL for CrackHouse's workload characteristics
-- IMPORTANT: Some settings require server restart to take effect

-- Maximum number of concurrent connections
-- CrackHouse uses connection pooling, so 200 is sufficient
ALTER SYSTEM SET max_connections = 200;

-- Memory for caching database blocks
-- Set to ~25% of available RAM in production
ALTER SYSTEM SET shared_buffers = '256MB';

-- Estimate of memory available for disk caching
-- Used by query planner to estimate costs
ALTER SYSTEM SET effective_cache_size = '1GB';

-- ------------------------------------------------------------------------------
-- RELOAD CONFIGURATION
-- ------------------------------------------------------------------------------
-- Apply settings that don't require restart
-- (Settings like shared_buffers require restart and will apply on next startup)
SELECT pg_reload_conf();

-- ------------------------------------------------------------------------------
-- SECURITY: APPLICATION ROLES
-- ------------------------------------------------------------------------------
-- Create dedicated application role with limited privileges
-- This follows the principle of least privilege

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crackhouse_app') THEN
        -- Create role with login capability
        -- PASSWORD should be changed in production via environment variables
        CREATE ROLE crackhouse_app WITH LOGIN PASSWORD 'crackhouse_password';

        RAISE NOTICE 'Created crackhouse_app role';
    ELSE
        RAISE NOTICE 'crackhouse_app role already exists';
    END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- SECURITY: DATABASE PERMISSIONS
-- ------------------------------------------------------------------------------
-- Grant minimal necessary permissions to application role
-- Note: This script runs in the context of the database being initialized,
-- so we use current_database() to grant permissions dynamically

DO $$
BEGIN
    -- Grant CONNECT privilege on the current database
    -- This allows the application to connect to the database
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO crackhouse_app', current_database());

    RAISE NOTICE 'Granted CONNECT permission on database % to crackhouse_app', current_database();
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail initialization
        RAISE NOTICE 'Could not grant permissions: %', SQLERRM;
END
$$;

-- ------------------------------------------------------------------------------
-- SCHEMA PERMISSIONS
-- ------------------------------------------------------------------------------
-- Schema-level permissions will be applied by the application's migration system
-- after it creates the necessary schemas (public, drizzle, etc.)
--
-- The application will run:
--   GRANT USAGE ON SCHEMA public TO crackhouse_app;
--   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crackhouse_app;
--   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crackhouse_app;

-- Add role description for documentation
COMMENT ON ROLE crackhouse_app IS 'CrackHouse application role for database access - uses principle of least privilege';

-- ==============================================================================
-- INITIALIZATION COMPLETE
-- ==============================================================================
-- Database is now ready for CrackHouse application deployment
-- Next steps:
-- 1. Run database migrations: pnpm --filter @crackhouse/api db:migrate
-- 2. Seed initial data: pnpm --filter @crackhouse/api db:seed-superuser
-- ==============================================================================