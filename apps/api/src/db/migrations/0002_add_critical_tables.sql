-- Migration 0002: Add captures, config, and audit_logs tables
-- Date: 2025-12-31

-- Create new ENUM types
CREATE TYPE "public"."capture_status" AS ENUM('pending', 'processing', 'completed', 'failed');
CREATE TYPE "public"."config_type" AS ENUM('number', 'string', 'boolean');
CREATE TYPE "public"."config_category" AS ENUM('general', 'security', 'performance');

-- Create captures table
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"user_id" text NOT NULL,
	"status" "capture_status" DEFAULT 'pending' NOT NULL,
	"file_size" bigint NOT NULL,
	"file_path" varchar(1000),
	"network_count" integer DEFAULT 0,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create config table
CREATE TABLE "config" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" "config_category" NOT NULL,
	"type" "config_type" NOT NULL,
	"default_value" jsonb,
	"min_value" jsonb,
	"max_value" jsonb,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"requires_restart" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);

-- Create audit_logs table
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for captures
ALTER TABLE "captures" ADD CONSTRAINT "captures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Add foreign key constraints for config
ALTER TABLE "config" ADD CONSTRAINT "config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Add foreign key constraints for audit_logs
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for captures
CREATE INDEX "captures_user_id_idx" ON "captures"("user_id");
CREATE INDEX "captures_status_idx" ON "captures"("status");
CREATE INDEX "captures_uploaded_at_idx" ON "captures"("uploaded_at");

-- Create indexes for config
CREATE INDEX "config_id_idx" ON "config"("id");
CREATE INDEX "config_category_idx" ON "config"("category");

-- Create indexes for audit_logs
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
