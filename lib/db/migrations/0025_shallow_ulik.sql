ALTER TABLE "reviews" ALTER COLUMN "selected_provider" SET DEFAULT 'opencode';--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "selected_model" text;