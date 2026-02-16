-- Deployments integration tables

-- Integrations table: API token connections for deployment platforms
CREATE TABLE IF NOT EXISTS "integrations" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "external_user_id" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" timestamp,
  "username" text NOT NULL,
  "team_id" text,
  "token_created_at" timestamp,
  "token_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_user_provider_idx" ON "integrations" ("user_id", "provider");

-- Subscriptions table: Links deployment platform projects to GitHub repos
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "integration_id" text NOT NULL REFERENCES "integrations"("id") ON DELETE CASCADE,
  "platform_project_id" text NOT NULL,
  "platform_project_name" text NOT NULL,
  "webhook_id" text,
  "webhook_secret" text,
  "github_repo_full_name" text NOT NULL,
  "auto_fix_enabled" boolean DEFAULT true NOT NULL,
  "fix_branch_prefix" text DEFAULT 'fix/deployment-',
  "max_fix_attempts" integer DEFAULT 3,
  "notify_on_fix" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_project_idx" ON "subscriptions" ("user_id", "integration_id", "platform_project_id");

-- Fix rules table: User-defined rules for customizing error fixes
CREATE TABLE IF NOT EXISTS "fix_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "subscription_id" text REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "error_pattern" text NOT NULL,
  "error_type" text,
  "skip_fix" boolean DEFAULT false,
  "custom_prompt" text,
  "priority" integer DEFAULT 0,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fix_rules_subscription_idx" ON "fix_rules" ("subscription_id");

-- Deployments table: Tracks fix-related data for failed deployments
CREATE TABLE IF NOT EXISTS "deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "subscription_id" text NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "platform_deployment_id" text NOT NULL,
  "webhook_delivery_id" text,
  "fix_status" text DEFAULT 'pending' NOT NULL,
  "fix_attempt_number" integer DEFAULT 1,
  "version" integer DEFAULT 1 NOT NULL,
  "matched_rule_id" text REFERENCES "fix_rules"("id") ON DELETE SET NULL,
  "error_type" text,
  "error_message" text,
  "error_context" text,
  "task_id" text REFERENCES "tasks"("id") ON DELETE SET NULL,
  "pr_url" text,
  "pr_number" integer,
  "fix_branch_name" text,
  "fix_summary" text,
  "fix_details" text,
  "logs" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "deployments_subscription_idx" ON "deployments" ("subscription_id");
CREATE UNIQUE INDEX IF NOT EXISTS "deployments_platform_deployment_idx" ON "deployments" ("platform_deployment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "deployments_webhook_delivery_idx" ON "deployments" ("webhook_delivery_id");
CREATE INDEX IF NOT EXISTS "deployments_fix_status_idx" ON "deployments" ("fix_status");
