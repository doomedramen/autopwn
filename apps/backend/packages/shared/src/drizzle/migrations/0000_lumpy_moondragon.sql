CREATE TABLE "dictionaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "dictionaries_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "job_dictionaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"dictionary_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "job_dictionaries_job_id_dictionary_id_unique" UNIQUE("job_id","dictionary_id")
);
--> statement-breakpoint
CREATE TABLE "job_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"filename" text NOT NULL,
	"essid" text,
	"bssid" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"password" text,
	"cracked_at" timestamp,
	"pcap_filename" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text,
	"user_id" integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "pcap_essid_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pcap_filename" text NOT NULL,
	"essid" text NOT NULL,
	"bssid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pcap_essid_mapping_user_id_pcap_filename_essid_unique" UNIQUE("user_id","pcap_filename","essid")
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"essid" text NOT NULL,
	"password" text NOT NULL,
	"cracked_at" timestamp DEFAULT now() NOT NULL,
	"pcap_filename" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "dictionaries" ADD CONSTRAINT "dictionaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_dictionaries" ADD CONSTRAINT "job_dictionaries_dictionary_id_dictionaries_id_fk" FOREIGN KEY ("dictionary_id") REFERENCES "public"."dictionaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcap_essid_mapping" ADD CONSTRAINT "pcap_essid_mapping_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dictionaries_user_id_idx" ON "dictionaries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_dictionaries_job_id_idx" ON "job_dictionaries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_items_job_id_idx" ON "job_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_items_user_id_idx" ON "job_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_priority_idx" ON "jobs" USING btree ("priority" DESC NULLS LAST,"created_at");--> statement-breakpoint
CREATE INDEX "pcap_essid_mapping_user_id_idx" ON "pcap_essid_mapping" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pcap_essid_mapping_pcap_filename_idx" ON "pcap_essid_mapping" USING btree ("pcap_filename");--> statement-breakpoint
CREATE INDEX "pcap_essid_mapping_essid_idx" ON "pcap_essid_mapping" USING btree ("essid");--> statement-breakpoint
CREATE INDEX "results_job_id_idx" ON "results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "results_user_id_idx" ON "results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");