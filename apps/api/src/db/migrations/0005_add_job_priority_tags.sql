-- Migration: Add job priority and tags
-- Date: 2025-12-31

-- Add priority enum
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- Add priority column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority job_priority DEFAULT 'normal';

-- Add tags column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tags VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[];

-- Add index for priority
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority) WHERE priority IS NOT NULL;

-- Add index for tags
CREATE INDEX IF NOT EXISTS idx_jobs_tags ON jobs USING GIN(tags) WHERE tags IS NOT NULL;

COMMENT ON COLUMN jobs.priority IS 'Job priority (low, normal, high, critical)';
COMMENT ON COLUMN jobs.tags IS 'Job tags for organization and filtering';
