CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"keyPrefix" text NOT NULL,
	"keyHash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"action" text NOT NULL,
	"resourceType" text,
	"resourceId" text,
	"details" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"filename" text NOT NULL,
	"originalFilename" text NOT NULL,
	"filePath" text NOT NULL,
	"fileSize" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	"networkCount" integer DEFAULT 0 NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"maxConcurrentJobs" integer DEFAULT 2 NOT NULL,
	"maxPcapSize" integer DEFAULT 104857600 NOT NULL,
	"maxDictionarySize" integer DEFAULT 1073741824 NOT NULL,
	"maxGeneratedDictSize" integer DEFAULT 104857600 NOT NULL,
	"maxGenerationKeywords" integer DEFAULT 10 NOT NULL,
	"hashcatDefaultWorkload" integer DEFAULT 2 NOT NULL,
	"hashcatJobTimeout" integer DEFAULT 86400 NOT NULL,
	"allowUserRegistration" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dictionaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"filePath" text,
	"fileSize" integer,
	"lineCount" integer,
	"generationOptions" jsonb,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_dictionaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"dictionaryId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"networkId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"attackMode" text NOT NULL,
	"hashcatOptions" jsonb,
	"progress" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currentSpeed" text,
	"timeRemaining" integer,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"duration" integer,
	"queuePosition" integer,
	"crackedCount" integer DEFAULT 0 NOT NULL,
	"totalNetworks" integer DEFAULT 0 NOT NULL,
	"totalDictionaries" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"captureId" uuid NOT NULL,
	"userId" text NOT NULL,
	"ssid" text NOT NULL,
	"bssid" text NOT NULL,
	"handshakeType" text,
	"hc22000FilePath" text NOT NULL,
	"extractedAt" timestamp DEFAULT now() NOT NULL,
	"isCracked" boolean DEFAULT false NOT NULL,
	"crackedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"networkId" uuid NOT NULL,
	"jobId" uuid,
	"dictionaryId" uuid,
	"userId" text NOT NULL,
	"password" text NOT NULL,
	"crackedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"passwordHash" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastLoginAt" timestamp,
	"deletedAt" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys" ("keyPrefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "captures_user_id_idx" ON "captures" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "captures_status_idx" ON "captures" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "captures_uploaded_at_idx" ON "captures" ("uploadedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dictionaries_user_id_idx" ON "dictionaries" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dictionaries_type_idx" ON "dictionaries" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dictionaries_status_idx" ON "dictionaries" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_dictionaries_job_id_idx" ON "job_dictionaries" ("jobId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_dictionaries_dictionary_id_idx" ON "job_dictionaries" ("dictionaryId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_networks_job_id_idx" ON "job_networks" ("jobId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_networks_network_id_idx" ON "job_networks" ("networkId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_id_idx" ON "jobs" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "jobs" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "networks_capture_id_idx" ON "networks" ("captureId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "networks_user_id_idx" ON "networks" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "networks_bssid_idx" ON "networks" ("bssid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "networks_is_cracked_idx" ON "networks" ("isCracked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "results_network_id_idx" ON "results" ("networkId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "results_job_id_idx" ON "results" ("jobId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "results_user_id_idx" ON "results" ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "captures" ADD CONSTRAINT "captures_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dictionaries" ADD CONSTRAINT "dictionaries_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_dictionaryId_dictionaries_id_fk" FOREIGN KEY ("dictionaryId") REFERENCES "dictionaries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_networks" ADD CONSTRAINT "job_networks_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_networks" ADD CONSTRAINT "job_networks_networkId_networks_id_fk" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "networks" ADD CONSTRAINT "networks_captureId_captures_id_fk" FOREIGN KEY ("captureId") REFERENCES "captures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "networks" ADD CONSTRAINT "networks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "results" ADD CONSTRAINT "results_networkId_networks_id_fk" FOREIGN KEY ("networkId") REFERENCES "networks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "results" ADD CONSTRAINT "results_jobId_jobs_id_fk" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "results" ADD CONSTRAINT "results_dictionaryId_dictionaries_id_fk" FOREIGN KEY ("dictionaryId") REFERENCES "dictionaries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "results" ADD CONSTRAINT "results_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
