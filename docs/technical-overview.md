# Technical Overview: CloudCode

CloudCode is a sophisticated platform for building and managing AI-powered coding agents. It provides the infrastructure to run agents safely in isolated sandboxes, manage multi-user sessions, and automate complex Git workflows.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **UI**: [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [Jotai](https://jotai.org/) (Client-side), [Drizzle ORM](https://orm.drizzle.team/) (Server-side)
- **Database**: PostgreSQL (via [Neon](https://neon.tech/))
- **Background Jobs**: [Inngest](https://www.inngest.com/)
- **Isolation**: [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai/docs), [Octokit](https://github.com/octokit/rest.js) (GitHub API)

## Architecture

### 1. Multi-User & Security
The system is designed for multi-tenancy. 
- **Authentication**: Supports GitHub and Vercel OAuth.
- **Data Isolation**: Every task and API key is scoped to a specific `userId`.
- **Encryption**: Sensitive data (API keys, GitHub tokens) is encrypted at rest using `AES-256-GCM`.
- **Log Redaction**: A specialized logging utility (`lib/utils/logging.ts`) automatically redacts credentials from user-facing logs.

### 2. Task Execution Flow
1. **Creation**: User submits a repository and a prompt.
2. **Branching**: The system generates an AI-powered branch name (e.g., `feat/add-login-a1b2c3`) using the AI SDK.
3. **Sandbox Provisioning**: A Vercel Sandbox is spun up with the repository pre-cloned.
4. **Agent Execution**: The selected agent (Claude, Gemini, etc.) executes the task via shell commands.
5. **Git Push**: Once complete, changes are committed and pushed to the new branch.
6. **Cleanup**: Depending on the "Keep Alive" setting, the sandbox is either destroyed or held for follow-up messages.

### 3. Background Processing (Inngest)
CloudCode uses Inngest for durable execution of long-running or scheduled tasks:
- **PR Reviews**: Webhooks from GitHub trigger an Inngest function that fetches diffs, analyzes them with AI, and posts review comments.
- **Scheduled Tasks**: Four fixed cron slots (4 AM, 9 AM, 12 PM, 9 PM UTC) dispatch recurring maintenance tasks (e.g., daily security scans).

## Directory Structure

- `app/`: Next.js routes and layouts. Nested `[owner]/[repo]` routes handle repository-specific views.
- `components/`:
    - `ui/`: Base shadcn components.
    - `task-*.tsx`: Components for the task execution interface (terminal, chat, logs).
    - `reviews/`: Components for the AI Code Review dashboard.
- `lib/`:
    - `db/`: Database schema (users, tasks, keys, reviews, etc.).
    - `inngest/`: Background job definitions and event handlers.
    - `sandbox/`: Interface for managing Vercel Sandbox lifecycles.
    - `github/`: Helpers for repository browsing and Git operations.
- `types/`: Shared TypeScript interfaces and Inngest event schemas.

## Key Environment Variables

- `POSTGRES_URL`: Neon database connection string.
- `SANDBOX_VERCEL_TOKEN`: Required for sandbox creation.
- `ENCRYPTION_KEY`: 32-byte hex string for at-rest encryption.
- `JWE_SECRET`: Secret for session token encryption.
- `NEXT_PUBLIC_AUTH_PROVIDERS`: Configures allowed login methods.

## Security Guidelines for AI Agents
Agents working on this codebase must adhere to the rules in `AGENTS.md`, specifically:
- **No Dynamic Logs**: Never log template literals with `${}` to prevent data leakage.
- **No Dev Servers**: Do not run `npm run dev` inside the sandbox as it blocks execution.
- **Formatting**: Always run `pnpm format` and `pnpm type-check` before finalizing changes.
