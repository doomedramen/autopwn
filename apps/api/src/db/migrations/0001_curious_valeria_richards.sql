ALTER TYPE "public"."role" ADD VALUE 'superuser';--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "provider" SET DEFAULT 'credential';