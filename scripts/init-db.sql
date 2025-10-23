-- AutoPWN Database Initialization Script
-- This script runs when PostgreSQL containers are first created

-- Create additional extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database-specific configurations
-- These settings optimize PostgreSQL for AutoPWN workloads

-- Set timezone
SET timezone = 'UTC';

-- Configure performance settings for testing and development
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Configure logging
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking > 1s

-- Configure connection limits
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Reload configuration
SELECT pg_reload_conf();

-- Create default roles and permissions for security
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'autopwn_app') THEN
        CREATE ROLE autopwn_app WITH LOGIN PASSWORD 'autopwn_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE autopwn_development TO autopwn_app;
GRANT CONNECT ON DATABASE autopwn_test TO autopwn_app;
GRANT CONNECT ON DATABASE autopwn_production TO autopwn_app;

-- Set up schema permissions for the application role
-- This will be applied after the application creates its schemas

COMMENT ON ROLE autopwn_app IS 'AutoPWN application role for database access';