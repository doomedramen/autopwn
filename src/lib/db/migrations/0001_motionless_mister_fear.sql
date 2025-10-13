CREATE TABLE "job_pcaps" (
	"job_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_pcaps_job_id_upload_id_pk" PRIMARY KEY("job_id","upload_id")
);
--> statement-breakpoint
ALTER TABLE "job_pcaps" ADD CONSTRAINT "job_pcaps_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_pcaps" ADD CONSTRAINT "job_pcaps_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_pcaps_job_idx" ON "job_pcaps" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_pcaps_upload_idx" ON "job_pcaps" USING btree ("upload_id");