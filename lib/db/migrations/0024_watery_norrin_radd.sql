ALTER TABLE "scheduled_tasks" RENAME COLUMN "selected_agent" TO "selected_provider";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "selected_agent" TO "selected_provider";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "agent_session_id" TO "opencode_session_id";--> statement-breakpoint
ALTER TABLE "vercel_subscriptions" RENAME COLUMN "selected_agent" TO "selected_provider";--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "selected_provider" text;--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "selected_agent";