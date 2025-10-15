-- Migration script to add missing 'name' column to jobs table
-- This addresses the error: column "name" does not exist

-- Check if the column exists, and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE jobs ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'Unnamed Job';
        RAISE NOTICE 'Added missing name column to jobs table';
    ELSE
        RAISE NOTICE 'name column already exists in jobs table';
    END IF;
END $$;

-- Update any existing jobs that might have the default name
UPDATE jobs
SET name = 'Job ' || EXTRACT(epoch FROM created_at)::text
WHERE name = 'Unnamed Job' OR name IS NULL;