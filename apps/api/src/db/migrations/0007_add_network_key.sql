-- Migration: Add key column to networks table
-- Date: 2026-01-12

ALTER TABLE "networks" ADD COLUMN IF NOT EXISTS "key" text;
