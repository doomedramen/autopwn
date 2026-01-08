-- Add progress metadata column to jobs table for real-time tracking
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "progress_metadata" jsonb;--> statement-breakpoint

-- Create GIN index on progress metadata for efficient querying
CREATE INDEX IF NOT EXISTS "idx_jobs_progress_metadata" ON "jobs" USING GIN ("progress_metadata");--> statement-breakpoint

-- Add comment for documentation
COMMENT ON COLUMN "jobs"."progress_metadata" IS 'Detailed progress tracking metadata including stage, ETA, speed, and passwords tested';
