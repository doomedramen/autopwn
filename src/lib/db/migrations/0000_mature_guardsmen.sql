CREATE TABLE "cracked_passwords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"network_id" uuid,
	"hash" text NOT NULL,
	"plain_password" text NOT NULL,
	"salt" text,
	"hex_plain" text,
	"cracked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_dictionaries" (
	"job_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_dictionaries_job_id_upload_id_pk" PRIMARY KEY("job_id","upload_id")
);
--> statement-breakpoint
CREATE TABLE "job_networks" (
	"job_id" uuid NOT NULL,
	"network_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_networks_job_id_network_id_pk" PRIMARY KEY("job_id","network_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"cracked" integer DEFAULT 0,
	"total_hashes" integer DEFAULT 0,
	"speed_current" numeric(10, 2),
	"speed_average" numeric(10, 2),
	"speed_unit" varchar(10) DEFAULT 'H/s',
	"eta" varchar(50),
	"hashcat_session" varchar(255),
	"consolidated_file_path" text,
	"job_options" jsonb NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid,
	"essid" varchar(255),
	"bssid" varchar(17) NOT NULL,
	"channel" integer,
	"encryption" varchar(50),
	"has_handshake" boolean DEFAULT false,
	"first_seen" timestamp,
	"last_seen" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "networks_upload_bssid_unique" UNIQUE("upload_id","bssid")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" bigint NOT NULL,
	"file_checksum" varchar(64) NOT NULL,
	"mime_type" varchar(100),
	"upload_type" varchar(20) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cracked_passwords" ADD CONSTRAINT "cracked_passwords_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cracked_passwords" ADD CONSTRAINT "cracked_passwords_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_networks" ADD CONSTRAINT "job_networks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_networks" ADD CONSTRAINT "job_networks_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "networks" ADD CONSTRAINT "networks_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cracked_passwords_job_idx" ON "cracked_passwords" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "cracked_passwords_network_idx" ON "cracked_passwords" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "cracked_passwords_hash_idx" ON "cracked_passwords" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "job_dictionaries_job_idx" ON "job_dictionaries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_dictionaries_upload_idx" ON "job_dictionaries" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "job_networks_job_idx" ON "job_networks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_networks_network_idx" ON "job_networks" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "jobs_user_status_idx" ON "jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_session_idx" ON "jobs" USING btree ("hashcat_session");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "networks_bssid_idx" ON "networks" USING btree ("bssid");--> statement-breakpoint
CREATE INDEX "networks_handshake_idx" ON "networks" USING btree ("has_handshake");--> statement-breakpoint
CREATE INDEX "networks_upload_idx" ON "networks" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "uploads_user_type_idx" ON "uploads" USING btree ("user_id","upload_type");--> statement-breakpoint
CREATE INDEX "uploads_checksum_idx" ON "uploads" USING btree ("file_checksum");--> statement-breakpoint
CREATE INDEX "uploads_type_idx" ON "uploads" USING btree ("upload_type");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");