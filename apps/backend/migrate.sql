-- AutoPWN Database Schema Migration
-- This script creates all necessary tables for the AutoPWN WiFi handshake cracking application

-- Users table for authentication
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Dictionaries table with user ownership
CREATE TABLE IF NOT EXISTS "dictionaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "dictionaries_user_id_name_unique" UNIQUE("user_id","name")
);

-- Jobs table with user ownership
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"filename" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"paused" integer DEFAULT 0 NOT NULL,
	"batch_mode" integer DEFAULT 0 NOT NULL,
	"items_total" integer,
	"items_cracked" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"current_dictionary" text,
	"progress" real,
	"hash_count" integer,
	"speed" text,
	"eta" text,
	"error" text,
	"logs" text,
	"captures" text,
	"total_hashes" integer
);

-- Job items table with user ownership
CREATE TABLE IF NOT EXISTS "job_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"filename" text NOT NULL,
	"essid" text,
	"bssid" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"password" text,
	"cracked_at" timestamp,
	"pcap_filename" text
);

-- Job dictionaries table (junction table)
CREATE TABLE IF NOT EXISTS "job_dictionaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"dictionary_id" integer NOT NULL REFERENCES "dictionaries"("id") ON DELETE cascade,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "job_dictionaries_job_id_dictionary_id_unique" UNIQUE("job_id","dictionary_id")
);

-- Results table with user ownership
CREATE TABLE IF NOT EXISTS "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"essid" text NOT NULL,
	"password" text NOT NULL,
	"cracked_at" timestamp DEFAULT now() NOT NULL,
	"pcap_filename" text
);

-- PCAP ESSID mapping table with user ownership
CREATE TABLE IF NOT EXISTS "pcap_essid_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"pcap_filename" text NOT NULL,
	"essid" text NOT NULL,
	"bssid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pcap_essid_mapping_user_id_pcap_filename_essid_unique" UNIQUE("user_id","pcap_filename","essid")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX IF NOT EXISTS "jobs_user_id_idx" ON "jobs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "jobs_priority_idx" ON "jobs" USING btree ("priority" DESC NULLS LAST,"created_at");
CREATE INDEX IF NOT EXISTS "job_items_job_id_idx" ON "job_items" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "job_items_user_id_idx" ON "job_items" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "job_dictionaries_job_id_idx" ON "job_dictionaries" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "results_job_id_idx" ON "results" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "results_user_id_idx" ON "results" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "dictionaries_user_id_idx" ON "dictionaries" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "pcap_essid_mapping_user_id_idx" ON "pcap_essid_mapping" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "pcap_essid_mapping_pcap_filename_idx" ON "pcap_essid_mapping" USING btree ("pcap_filename");
CREATE INDEX IF NOT EXISTS "pcap_essid_mapping_essid_idx" ON "pcap_essid_mapping" USING btree ("essid");