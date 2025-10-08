-- AutoPWN Database Initialization Script
-- This script is run when the PostgreSQL container starts for the first time

-- Enable UUID extension for better-auth if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the database schema using the generated migration
-- Note: The actual schema will be created by the application's migration system
-- This script can be used for any initial setup if needed

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE autopwn TO autopwn;

-- Create any additional indexes or optimizations
-- These can be added as needed for performance tuning

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'AutoPWN database initialized successfully';
END $$;