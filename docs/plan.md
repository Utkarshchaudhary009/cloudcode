# Code Review & Scheduled Tasks Implementation Plan

## Overview

This document outlines the implementation plan for two new features:

1. **Automatic Code Review** - AI-powered PR reviews triggered via GitHub webhooks
2. **Scheduled Tasks** - User-defined recurring tasks (bug finding, UI review, security scans) running at fixed time slots

Both features use **Inngest** for reliable, durable execution with automatic retries and observability.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB WEBHOOKS                                │
│                                                                             │
│   PR Opened/Updated ──► /api/webhooks/github ──► inngest.send()            │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌─────────────────────┐                            │
│                         │  pr.review.requested │ (event)                   │
│                         └─────────────────────┘                            │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌──────────────────────────────┐                        │
│                    │  Inngest: handle-pr-review   │                        │
│                    │  ├─ step.run("fetch-diff")   │                        │
│                    │  ├─ step.run("ai-review")    │                        │
│                    │  └─ step.run("post-comments")│                        │
│                    └──────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCHEDULED TASKS                                   │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │  4 FIXED CRONS (UTC)                                             │     │
│   │  ├─ scheduled-tasks-4am   { cron: "0 4 * * *" }                 │     │
│   │  ├─ scheduled-tasks-9am   { cron: "0 9 * * *" }                 │     │
│   │  ├─ scheduled-tasks-12pm  { cron: "0 12 * * *" }                │     │
│   │  └─ scheduled-tasks-9pm   { cron: "0 21 * * *" }                │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│              ┌─────────────────────────────────────────┐                   │
│              │  Query DB: WHERE time_slot = '9am'      │                   │
│              │            AND enabled = true           │                   │
│              │            AND day_of_week matches      │                   │
│              └─────────────────────────────────────────┘                   │
│                                    │                                        │
│                                    ▼                                        │
│              ┌─────────────────────────────────────────┐                   │
│              │  Fan-out: inngest.send(tasks.map(...)) │                   │
│              └─────────────────────────────────────────┘                   │
│                          │    │    │    │                                   │
│                          ▼    ▼    ▼    ▼                                   │
│              ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │
│              │Task1│ │Task2│ │Task3│ │TaskN│  (parallel execution)         │
│              └─────┘ └─────┘ └─────┘ └─────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Scheduled tasks configuration
CREATE TABLE scheduled_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Task configuration
  name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'bug_finder',
    'ui_review', 
    'security_scan',
    'code_quality',
    'performance_audit',
    'custom'
  )),
  
  -- Schedule configuration
  time_slot TEXT NOT NULL CHECK (time_slot IN ('4am', '9am', '12pm', '9pm')),
  days JSONB NOT NULL DEFAULT '["daily"]',  -- ['mon', 'wed', 'fri'] or ['daily']
  timezone TEXT NOT NULL DEFAULT 'UTC',      -- For display purposes
  
  -- Agent configuration
  selected_agent TEXT DEFAULT 'openai',
  selected_model TEXT,
  
  -- State
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error', 'running')),
  last_run_task_id TEXT REFERENCES tasks(id),
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PR Reviews
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id),
  
  -- PR information
  repo_url TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  pr_author TEXT,
  head_sha TEXT NOT NULL,
  base_branch TEXT,
  head_branch TEXT,
  
  -- Review state
  status TEXT NOT NULL CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'error'
  )) DEFAULT 'pending',
  
  -- Review results
  summary TEXT,
  findings JSONB,  -- Array of { file, line, severity, message, suggestion }
  score INTEGER,   -- 0-100 code quality score
  
  -- Configuration used
  selected_agent TEXT,
  review_rules JSONB,  -- User's custom rules applied
  
  -- Metadata
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one review per PR + commit
  UNIQUE(repo_url, pr_number, head_sha)
);

-- Review rules (user-defined)
CREATE TABLE review_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Rule configuration
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,  -- Natural language rule
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')) DEFAULT 'warning',
  
  -- Scope
  repo_url TEXT,         -- NULL = applies to all repos
  file_patterns JSONB,   -- ['*.ts', '*.tsx'] or NULL for all files
  
  -- State
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- GitHub webhook installations (for auto-review)
CREATE TABLE github_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- GitHub App installation
  installation_id TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  
  -- Configuration
  auto_review_enabled BOOLEAN NOT NULL DEFAULT true,
  review_on_draft BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, repo_url)
);

-- Indexes
CREATE INDEX idx_scheduled_tasks_time_slot ON scheduled_tasks(time_slot, enabled);
CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_repo_pr ON reviews(repo_url, pr_number);
CREATE INDEX idx_review_rules_user ON review_rules(user_id);
CREATE INDEX idx_github_installations_user ON github_installations(user_id);
```

---

## Inngest Functions

### Directory Structure

```
lib/
└── inngest/
    ├── client.ts              # Inngest client initialization
    ├── functions/
    │   ├── index.ts           # Export all functions
    │   ├── scheduled-tasks/
    │   │   ├── dispatcher-4am.ts
    │   │   ├── dispatcher-9am.ts
    │   │   ├── dispatcher-12pm.ts
    │   │   ├── dispatcher-9pm.ts
    │   │   └── execute-task.ts
    │   └── reviews/
    │       ├── handle-pr-review.ts
    │       └── post-review-comments.ts
    └── events.ts              # Event type definitions
```

### Inngest Client

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'cloudcode',
  schemas: new EventSchemas().fromRecord<Events>(),
})
```

### Event Definitions

```typescript
// lib/inngest/events.ts
export type Events = {
  'scheduled-task/execute': {
    data: {
      scheduledTaskId: string
      userId: string
      repoUrl: string
      prompt: string
      taskType: string
      selectedAgent: string
      selectedModel?: string
    }
  }
  'pr/review.requested': {
    data: {
      userId: string
      repoUrl: string
      prNumber: number
      prTitle: string
      prAuthor: string
      headSha: string
      baseBranch: string
      headBranch: string
      installationId: string
    }
  }
  'review/post-comments': {
    data: {
      reviewId: string
      userId: string
      repoUrl: string
      prNumber: number
      findings: ReviewFinding[]
    }
  }
}
```

### Scheduled Task Dispatcher (Example: 9am)

```typescript
// lib/inngest/functions/scheduled-tasks/dispatcher-9am.ts
import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { scheduledTasks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const scheduledTasksDispatcher9am = inngest.createFunction(
  { id: 'scheduled-tasks-dispatcher-9am' },
  { cron: 'TZ=UTC 0 9 * * *' },
  async ({ step }) => {
    // Get current day of week
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
    
    // Fetch all enabled tasks for this time slot
    const tasks = await step.run('fetch-tasks', async () => {
      return await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.timeSlot, '9am'),
            eq(scheduledTasks.enabled, true)
          )
        )
    })
    
    // Filter by day of week
    const tasksToRun = tasks.filter(task => {
      const days = task.days as string[]
      return days.includes('daily') || days.includes(dayOfWeek)
    })
    
    if (tasksToRun.length === 0) {
      return { message: 'No tasks to run', count: 0 }
    }
    
    // Fan-out: send events for each task
    await step.sendEvent(
      'fan-out-tasks',
      tasksToRun.map(task => ({
        name: 'scheduled-task/execute' as const,
        data: {
          scheduledTaskId: task.id,
          userId: task.userId,
          repoUrl: task.repoUrl,
          prompt: task.prompt,
          taskType: task.taskType,
          selectedAgent: task.selectedAgent,
          selectedModel: task.selectedModel,
        },
      }))
    )
    
    return { message: 'Tasks dispatched', count: tasksToRun.length }
  }
)
```

### Execute Scheduled Task

```typescript
// lib/inngest/functions/scheduled-tasks/execute-task.ts
import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { scheduledTasks, tasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const executeScheduledTask = inngest.createFunction(
  {
    id: 'execute-scheduled-task',
    concurrency: {
      limit: 10,  // Max 10 concurrent task executions
    },
    retries: 3,
  },
  { event: 'scheduled-task/execute' },
  async ({ event, step }) => {
    const { scheduledTaskId, userId, repoUrl, prompt, taskType, selectedAgent, selectedModel } = event.data
    
    // Create a new task in the tasks table
    const taskId = await step.run('create-task', async () => {
      const id = nanoid()
      await db.insert(tasks).values({
        id,
        userId,
        repoUrl,
        prompt: `[Scheduled: ${taskType}] ${prompt}`,
        selectedAgent,
        selectedModel,
        status: 'pending',
      })
      return id
    })
    
    // Update scheduled task status
    await step.run('update-scheduled-task-status', async () => {
      await db
        .update(scheduledTasks)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: 'running',
          lastRunTaskId: taskId,
          updatedAt: new Date(),
        })
        .where(eq(scheduledTasks.id, scheduledTaskId))
    })
    
    // Execute the task (reuse existing sandbox logic)
    const result = await step.run('execute-in-sandbox', async () => {
      // This will call your existing task execution logic
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${taskId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      return response.json()
    })
    
    // Update final status
    await step.run('update-final-status', async () => {
      await db
        .update(scheduledTasks)
        .set({
          lastRunStatus: result.success ? 'success' : 'error',
          updatedAt: new Date(),
        })
        .where(eq(scheduledTasks.id, scheduledTaskId))
    })
    
    return { taskId, result }
  }
)
```

### Handle PR Review

```typescript
// lib/inngest/functions/reviews/handle-pr-review.ts
import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { reviews, reviewRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export const handlePrReview = inngest.createFunction(
  {
    id: 'handle-pr-review',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: 'pr/review.requested' },
  async ({ event, step }) => {
    const { userId, repoUrl, prNumber, headSha, prTitle, prAuthor, baseBranch, headBranch } = event.data
    
    // Check if review already exists for this commit
    const existingReview = await step.run('check-existing', async () => {
      const existing = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.repoUrl, repoUrl),
            eq(reviews.prNumber, prNumber),
            eq(reviews.headSha, headSha)
          )
        )
        .limit(1)
      return existing[0]
    })
    
    if (existingReview) {
      return { message: 'Review already exists', reviewId: existingReview.id }
    }
    
    // Create review record
    const reviewId = await step.run('create-review', async () => {
      const id = nanoid()
      await db.insert(reviews).values({
        id,
        userId,
        repoUrl,
        prNumber,
        prTitle,
        prAuthor,
        headSha,
        baseBranch,
        headBranch,
        status: 'in_progress',
        startedAt: new Date(),
      })
      return id
    })
    
    // Fetch PR diff
    const diff = await step.run('fetch-diff', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/github/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, repoUrl, prNumber }),
      })
      return response.json()
    })
    
    // Fetch user's review rules
    const rules = await step.run('fetch-rules', async () => {
      return await db
        .select()
        .from(reviewRules)
        .where(
          and(
            eq(reviewRules.userId, userId),
            eq(reviewRules.enabled, true)
          )
        )
    })
    
    // Run AI review
    const findings = await step.run('ai-review', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diff,
          rules,
          repoUrl,
          prTitle,
        }),
      })
      return response.json()
    })
    
    // Update review with findings
    await step.run('save-findings', async () => {
      await db
        .update(reviews)
        .set({
          status: 'completed',
          summary: findings.summary,
          findings: findings.items,
          score: findings.score,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId))
    })
    
    // Post comments to GitHub
    await step.sendEvent('post-comments', {
      name: 'review/post-comments',
      data: {
        reviewId,
        userId,
        repoUrl,
        prNumber,
        findings: findings.items,
      },
    })
    
    return { reviewId, findingsCount: findings.items.length, score: findings.score }
  }
)
```

---

## API Routes

### New Routes Structure

```
app/api/
├── inngest/
│   └── route.ts                    # Inngest serve endpoint
├── webhooks/
│   └── github/
│       └── route.ts                # GitHub webhook handler
├── scheduled-tasks/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       └── route.ts                # GET, PATCH, DELETE
├── reviews/
│   ├── route.ts                    # GET (list)
│   ├── [id]/
│   │   └── route.ts                # GET (single review)
│   └── analyze/
│       └── route.ts                # POST (AI analysis)
├── review-rules/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       └── route.ts                # GET, PATCH, DELETE
└── github-installations/
    ├── route.ts                    # GET (list), POST (create)
    └── [id]/
        └── route.ts                # DELETE
```

### Inngest Serve Endpoint

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { 
  scheduledTasksDispatcher4am,
  scheduledTasksDispatcher9am,
  scheduledTasksDispatcher12pm,
  scheduledTasksDispatcher9pm,
  executeScheduledTask,
  handlePrReview,
  postReviewComments,
} from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Scheduled task dispatchers
    scheduledTasksDispatcher4am,
    scheduledTasksDispatcher9am,
    scheduledTasksDispatcher12pm,
    scheduledTasksDispatcher9pm,
    executeScheduledTask,
    
    // PR review functions
    handlePrReview,
    postReviewComments,
  ],
})
```

### GitHub Webhook Handler

```typescript
// app/api/webhooks/github/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db/client'
import { githubInstallations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  
  // Verify webhook signature
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')}`
  
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const event = request.headers.get('x-github-event')
  const payload = JSON.parse(body)
  
  if (event === 'pull_request') {
    const action = payload.action
    
    if (['opened', 'synchronize', 'reopened'].includes(action)) {
      const repoUrl = payload.repository.html_url
      const prNumber = payload.pull_request.number
      
      // Find installation for this repo
      const installation = await db
        .select()
        .from(githubInstallations)
        .where(
          and(
            eq(githubInstallations.repoUrl, repoUrl),
            eq(githubInstallations.autoReviewEnabled, true)
          )
        )
        .limit(1)
      
      if (installation[0]) {
        // Skip draft PRs if configured
        if (payload.pull_request.draft && !installation[0].reviewOnDraft) {
          return NextResponse.json({ message: 'Skipping draft PR' })
        }
        
        // Trigger review
        await inngest.send({
          name: 'pr/review.requested',
          data: {
            userId: installation[0].userId,
            repoUrl,
            prNumber,
            prTitle: payload.pull_request.title,
            prAuthor: payload.pull_request.user.login,
            headSha: payload.pull_request.head.sha,
            baseBranch: payload.pull_request.base.ref,
            headBranch: payload.pull_request.head.ref,
            installationId: installation[0].installationId,
          },
        })
        
        return NextResponse.json({ message: 'Review triggered' })
      }
    }
  }
  
  return NextResponse.json({ message: 'Event ignored' })
}
```

---

## UI Components

### New Components

```
components/
├── scheduled-tasks/
│   ├── scheduled-task-form.tsx      # Create/edit form
│   ├── scheduled-task-list.tsx      # List with status
│   ├── scheduled-task-card.tsx      # Individual task card
│   ├── time-slot-picker.tsx         # 4am/9am/12pm/9pm selector
│   └── day-picker.tsx               # Mon/Tue/Wed... or Daily
├── reviews/
│   ├── review-list.tsx              # List of PR reviews
│   ├── review-detail.tsx            # Single review with findings
│   ├── review-finding-card.tsx      # Individual finding
│   └── review-score-badge.tsx       # Quality score display
├── review-rules/
│   ├── review-rule-form.tsx         # Create/edit rule
│   └── review-rule-list.tsx         # List of rules
└── github-integration/
    ├── github-app-install.tsx       # Install GitHub App
    └── repo-webhook-settings.tsx    # Per-repo settings
```

### New Pages

```
app/
├── scheduled-tasks/
│   ├── page.tsx                     # List all scheduled tasks
│   └── new/
│       └── page.tsx                 # Create new scheduled task
├── reviews/
│   ├── page.tsx                     # List all reviews
│   └── [id]/
│       └── page.tsx                 # Review detail
├── settings/
│   ├── review-rules/
│   │   └── page.tsx                 # Manage review rules
│   └── integrations/
│       └── page.tsx                 # GitHub App installation
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up Inngest client and serve endpoint
- [ ] Create database migrations for new tables
- [ ] Implement Drizzle schema for new tables
- [ ] Create 4 dispatcher cron functions (empty, just logging)
- [ ] Test Inngest dev server locally

### Phase 2: Scheduled Tasks (Week 2)
- [ ] Implement `executeScheduledTask` function
- [ ] Create CRUD API routes for scheduled tasks
- [ ] Build scheduled task form component (time slot picker, day picker)
- [ ] Build scheduled task list component
- [ ] Create scheduled tasks page
- [ ] Add scheduled tasks to sidebar navigation
- [ ] Wire up dispatchers to fan-out events

### Phase 3: Code Review - Core (Week 3)
- [ ] Create GitHub App for webhooks
- [ ] Implement webhook handler
- [ ] Implement `handlePrReview` function
- [ ] Create `/api/reviews/analyze` endpoint (AI integration)
- [ ] Implement `postReviewComments` function
- [ ] Create reviews table and API routes

### Phase 4: Code Review - UI (Week 4)
- [ ] Build review list page
- [ ] Build review detail page with findings
- [ ] Create review score badge component
- [ ] Add reviews to sidebar navigation
- [ ] Implement GitHub App installation flow

### Phase 5: Review Rules (Week 5)
- [ ] Create review rules CRUD API
- [ ] Build review rules management page
- [ ] Integrate rules into review process
- [ ] Add rule-based findings to review output

### Phase 6: Polish & Testing (Week 6)
- [ ] End-to-end testing
- [ ] Error handling and edge cases
- [ ] Logging and observability
- [ ] Documentation
- [ ] Performance optimization

---

## Environment Variables

```bash
# Inngest
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx

# GitHub App (for webhooks)
GITHUB_APP_ID=xxx
GITHUB_APP_PRIVATE_KEY=xxx
GITHUB_WEBHOOK_SECRET=xxx
GITHUB_APP_CLIENT_ID=xxx
GITHUB_APP_CLIENT_SECRET=xxx
```

---

## Testing Strategy

### Unit Tests
- Inngest function logic (mocked steps)
- Database queries
- API route handlers

### Integration Tests
- Full Inngest function execution (using Inngest dev server)
- GitHub webhook processing
- End-to-end scheduled task flow

### Manual Testing
- Create scheduled task → wait for execution → verify results
- Open PR on test repo → verify review comments posted
- Test all 4 time slots with mock clock

---

## Monitoring & Observability

### Inngest Dashboard
- Monitor function runs, failures, retries
- View event history
- Debug step execution

### Application Logging
- Log all scheduled task executions
- Log review outcomes and scores
- Error tracking for failed reviews

### Alerts
- Slack notification on repeated failures
- Alert when scheduled task queue backs up
- Alert on low review scores (potential issues)

---

## Future Enhancements

1. **Custom cron expressions** (Pro tier feature)
2. **Review templates** (security-focused, performance-focused, etc.)
3. **Team sharing** of scheduled tasks and rules
4. **Slack/Discord notifications** for review results
5. **Review analytics dashboard** (trends, common issues)
6. **Auto-fix suggestions** with one-click apply
