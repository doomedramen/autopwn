-- Migration: Add job scheduling and dependencies
-- Date: 2025-12-31

-- Add scheduling columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add dependencies column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS depends_on JSONB DEFAULT '[]'::jsonb;

-- Add index for scheduled jobs
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Add index for cancelled jobs
CREATE INDEX IF NOT EXISTS idx_jobs_cancelled_at ON jobs(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Add index for dependencies
CREATE INDEX IF NOT EXISTS idx_jobs_depends_on ON jobs USING GIN(depends_on);

COMMENT ON COLUMN jobs.scheduled_at IS 'Timestamp when job should be executed (for scheduled jobs)';
COMMENT ON COLUMN jobs.cancelled_at IS 'Timestamp when job was cancelled (for cancelled jobs)';
COMMENT ON COLUMN jobs.depends_on IS 'Array of job IDs that must complete before this job can start';
