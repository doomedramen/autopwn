-- Add finishedAt and error fields to jobs table
ALTER TABLE jobs
ADD COLUMN "finishedAt" TIMESTAMP,
ADD COLUMN "error" TEXT;