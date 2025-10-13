-- Initialize AutoPWN database
-- This script runs when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance
-- These will be created by Drizzle migrations, but we can add them here for initial setup

-- You can add any custom initialization here
-- For example: default users, initial data, etc.