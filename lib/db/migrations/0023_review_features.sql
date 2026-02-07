CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "repo_url" text NOT NULL,
  "prompt" text NOT NULL,
  "task_type" text NOT NULL CHECK ("task_type" IN ('bug_finder', 'ui_review', 'security_scan', 'code_quality', 'performance_audit', 'custom')),
  "time_slot" text NOT NULL CHECK ("time_slot" IN ('4am', '9am', '12pm', '9pm')),
  "days" jsonb NOT NULL DEFAULT '["daily"]',
  "timezone" text NOT NULL DEFAULT 'UTC',
  "selected_agent" text DEFAULT 'openai',
  "selected_model" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamp,
  "last_run_status" text CHECK ("last_run_status" IN ('success', 'error', 'running')),
  "last_run_task_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "scheduled_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "scheduled_tasks_last_run_task_id_tasks_id_fk" FOREIGN KEY ("last_run_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_user_time_slot_idx" UNIQUE ("user_id", "repo_url", "time_slot");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "task_id" text,
  "repo_url" text NOT NULL,
  "pr_number" integer NOT NULL,
  "pr_title" text,
  "pr_author" text,
  "head_sha" text NOT NULL,
  "base_branch" text,
  "head_branch" text,
  "status" text NOT NULL CHECK ("status" IN ('pending', 'in_progress', 'completed', 'error')) DEFAULT 'pending',
  "summary" text,
  "findings" jsonb,
  "score" integer,
  "selected_agent" text,
  "review_rules" jsonb,
  "started_at" timestamp,
  "completed_at" timestamp,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "reviews_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_repo_pr_sha_idx" UNIQUE ("repo_url", "pr_number", "head_sha");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_rules" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "prompt" text NOT NULL,
  "severity" text NOT NULL CHECK ("severity" IN ('error', 'warning', 'info')) DEFAULT 'warning',
  "repo_url" text,
  "file_patterns" jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "review_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "review_rules" ADD CONSTRAINT "review_rules_user_name_idx" UNIQUE ("user_id", "name");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_installations" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "installation_id" text NOT NULL,
  "repo_url" text NOT NULL,
  "auto_review_enabled" boolean NOT NULL DEFAULT true,
  "review_on_draft" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "github_installations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_repo_idx" UNIQUE ("user_id", "repo_url");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_tasks_time_slot_idx" ON "scheduled_tasks" ("time_slot", "enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_tasks_user_idx" ON "scheduled_tasks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_user_idx" ON "reviews" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_repo_pr_idx" ON "reviews" ("repo_url", "pr_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_rules_user_idx" ON "review_rules" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_installations_user_idx" ON "github_installations" ("user_id");