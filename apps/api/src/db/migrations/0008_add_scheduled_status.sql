-- Migration: Add 'scheduled' to job_status enum
-- Date: 2026-01-12

ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'scheduled' AFTER 'pending';
