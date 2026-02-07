CREATE TABLE "build_fixes" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"deployment_url" text,
	"branch" text NOT NULL,
	"build_error" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_fix_commit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"repo_url" text NOT NULL,
	"auto_review_enabled" boolean DEFAULT true NOT NULL,
	"review_on_draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"repo_url" text,
	"file_patterns" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text,
	"repo_url" text NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_title" text,
	"pr_author" text,
	"head_sha" text NOT NULL,
	"base_branch" text,
	"head_branch" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"findings" jsonb,
	"score" integer,
	"selected_agent" text,
	"review_rules" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"repo_url" text NOT NULL,
	"prompt" text NOT NULL,
	"task_type" text NOT NULL,
	"time_slot" text NOT NULL,
	"days" jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"selected_agent" text DEFAULT 'openai',
	"selected_model" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" text,
	"last_run_task_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vercel_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"project_name" text NOT NULL,
	"repo_url" text,
	"team_id" text,
	"webhook_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"selected_agent" text DEFAULT 'openai',
	"selected_model" text,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "selected_agent" SET DEFAULT 'openai';--> statement-breakpoint
ALTER TABLE "build_fixes" ADD CONSTRAINT "build_fixes_subscription_id_vercel_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."vercel_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_rules" ADD CONSTRAINT "review_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_last_run_task_id_tasks_id_fk" FOREIGN KEY ("last_run_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vercel_subscriptions" ADD CONSTRAINT "vercel_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_user_repo_idx" ON "github_installations" USING btree ("user_id","repo_url");--> statement-breakpoint
CREATE UNIQUE INDEX "review_rules_user_name_idx" ON "review_rules" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_repo_pr_sha_idx" ON "reviews" USING btree ("repo_url","pr_number","head_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_tasks_user_time_slot_idx" ON "scheduled_tasks" USING btree ("user_id","repo_url","time_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "vercel_subscriptions_user_project_idx" ON "vercel_subscriptions" USING btree ("user_id","project_id");