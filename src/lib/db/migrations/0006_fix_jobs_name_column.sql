-- Add missing name column to jobs table
ALTER TABLE "jobs" ADD COLUMN "name" VARCHAR(255) NOT NULL DEFAULT 'Unnamed Job';