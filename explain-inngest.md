# Inngest Error Fix Flow - Complete Explanation

## Overview

Inngest is a serverless job queue that handles the deployment failure fix process asynchronously. It receives events from webhooks, processes them in steps, and coordinates between Vercel, the database, and the AI agent.

---

## Architecture Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vercel    │────▶│  Webhook API     │────▶│    Inngest      │
│ Deployment  │     │  /api/.../       │     │    Queue        │
│  Error      │     │  webhooks        │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │                        │
                            ▼                        ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │  Database        │     │  Inngest        │
                    │  - deployments   │     │  Function       │
                    │  - subscriptions │     │  (Steps)        │
                    └──────────────────┘     └─────────────────┘
                                                     │
                            ┌────────────────────────┼────────────────────────┐
                            ▼                        ▼                        ▼
                    ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
                    │ Vercel API   │        │ Build Log    │        │ AI Task      │
                    │ (get logs)   │        │ Analyzer     │        │ Creation     │
                    └──────────────┘        └──────────────┘        └──────────────┘
```

---

## Step-by-Step Flow

### Step 1: Webhook Reception

**File**: `app/api/integrations/vercel/webhooks/route.ts`

When a deployment fails on Vercel, it sends a webhook to our endpoint.

```typescript
// What Vercel sends
POST /api/integrations/vercel/webhooks
Headers: x-vercel-webhook-signature: sha1=...
Body: {
  type: 'deployment.error',
  payload: {
    deployment: { id: 'dpl_xxx', url: '...', name: 'my-project' },
    project: { id: 'proj_xxx' },
    team: { id: 'team_xxx' },
    user: { id: 'user_xxx' }
  },
  id: 'webhook-delivery-id',
  createdAt: '2024-01-15T10:30:00Z'
}
```

**What happens**:

1. **Parse payload**: Extract deployment ID, project ID, webhook delivery ID
2. **Verify signature**: Decrypt stored webhook secret, compute HMAC, verify it matches
3. **Find subscription**: Look up subscription by `platformProjectId` (project ID from Vercel)
4. **Check auto-fix enabled**: If `autoFixEnabled` is false, return early
5. **Create deployment record** in database with status `pending`
6. **Send Inngest event** with idempotency key (prevents duplicates)

**Database write**:
```sql
INSERT INTO deployments (id, subscription_id, platform_deployment_id, webhook_delivery_id, fix_status)
VALUES ('fix_xxx', 'sub_xxx', 'dpl_xxx', 'webhook_xxx', 'pending')
ON CONFLICT (platform_deployment_id) DO NOTHING
```

**Inngest event sent**:
```typescript
{
  name: 'deployment-failure/received',
  data: {
    fixId: 'fix_xxx',
    subscriptionId: 'sub_xxx',
    deploymentId: 'dpl_xxx',
    projectId: 'proj_xxx',
    webhookDeliveryId: 'webhook_xxx'
  }
}
```

---

### Step 2: Inngest Function - Handle Deployment Failure

**File**: `lib/inngest/functions/deployment/handle-deployment-failure.ts`

This function is triggered by the `deployment-failure/received` event.

#### Step 2.1: Update Status to Analyzing

```typescript
await step.run('update-status-analyzing', async () => {
  await updateDeploymentStatus(fixId, 'analyzing', { startedAt: new Date() })
})
```

**Database update**:
```sql
UPDATE deployments 
SET fix_status = 'analyzing', started_at = NOW(), updated_at = NOW()
WHERE id = 'fix_xxx'
```

#### Step 2.2: Get Subscription with Integration

```typescript
const subInfo = await step.run('get-subscription', async () => {
  return getSubscriptionWithIntegration(subscriptionId)
})
```

**Database reads**:
```sql
-- Get subscription
SELECT * FROM subscriptions WHERE id = 'sub_xxx'

-- Get integration (contains encrypted Vercel token)
SELECT * FROM integrations WHERE id = 'int_xxx'
```

**Returns**: `{ subscription, integration }`

#### Step 2.3: Fetch Build Logs from Vercel

```typescript
const logs = await step.run('fetch-logs', async () => {
  return getBuildLogs(deploymentId, subscription.teamId, token)
})
```

**Vercel API call**:
```
GET https://api.vercel.com/v13/deployments/dpl_xxx/events
Authorization: Bearer {decrypted_token}
```

**Response**: Raw build logs (stdout, stderr, command output)

**Database update**:
```sql
UPDATE deployments 
SET logs = '...all the build logs...', updated_at = NOW()
WHERE id = 'fix_xxx'
```

#### Step 2.4: Analyze Build Logs

```typescript
const analysis = await step.run('analyze-error', async () => {
  return analyzeBuildLogs(logs)
})
```

**File**: `lib/integrations/vercel/deployment/analyzer.ts`

**What it does**:
1. Splits logs into lines
2. Filters for error-related lines
3. Matches against error patterns:

| Error Type | Patterns |
|------------|----------|
| `typescript` | `error TS`, `TypeError:`, `Cannot find name`, `Property does not exist` |
| `dependency` | `npm ERR!`, `ERESOLVE`, `peer dep`, `Module not found` |
| `config` | `next.config.js`, `Invalid configuration`, `Environment variable` |
| `runtime` | `ReferenceError:`, `Cannot read`, `ENOENT:` |
| `build` | `Build error`, `Failed to compile`, `Webpack error` |

**Returns**:
```typescript
{
  errorType: 'typescript',
  errorMessage: "Cannot find name 'x'",
  errorContext: '...relevant lines around error...',
  affectedFiles: ['src/components/App.tsx', 'src/utils/helper.ts'],
  confidence: 0.8
}
```

#### Step 2.5: Find Matching Rule (Optional)

```typescript
const rule = await step.run('find-matching-rule', async () => {
  return findMatchingRule(subscriptionId, analysis)
})
```

**Database read**:
```sql
SELECT * FROM fix_rules 
WHERE subscription_id = 'sub_xxx' AND enabled = true
```

**What it does**:
- Checks if any user-defined rules match the error
- Rules can:
  - `skipFix: true` - Don't auto-fix this error pattern
  - `customPrompt: '...'` - Use custom instructions for fixing

**If rule.skipFix is true**:
```sql
UPDATE deployments 
SET fix_status = 'skipped', 
    error_type = 'typescript',
    error_message = '...',
    error_context = '...',
    matched_rule_id = 'rule_xxx',
    completed_at = NOW()
WHERE id = 'fix_xxx'
```
→ **Function returns early**, no fix attempted

#### Step 2.6: Update with Analysis Results

```sql
UPDATE deployments 
SET error_type = 'typescript',
    error_message = "Cannot find name 'x'",
    error_context = '...',
    matched_rule_id = NULL,
    updated_at = NOW()
WHERE id = 'fix_xxx'
```

#### Step 2.7: Create Fix Task

```typescript
const taskId = await step.run('create-fix-task', async () => {
  const id = nanoid()
  await db.insert(tasks).values({
    id,
    userId: subscription.userId,
    prompt: taskPrompt,
    title: 'Fix deployment error: typescript',
    repoUrl: 'https://github.com/owner/repo',
    selectedProvider: 'opencode',
    status: 'pending',
  })
  
  await updateDeploymentStatus(fixId, 'fixing', { taskId: id })
  return id
})
```

**Database writes**:
```sql
-- Create task
INSERT INTO tasks (id, user_id, prompt, title, repo_url, selected_provider, status)
VALUES ('task_xxx', 'user_xxx', 'Fix the following...', 'Fix deployment error...', 
        'https://github.com/owner/repo', 'opencode', 'pending')

-- Link deployment to task
UPDATE deployments 
SET fix_status = 'fixing', task_id = 'task_xxx'
WHERE id = 'fix_xxx'
```

**The prompt generated**:
```
Fix the following build error in the repository owner/repo.

## Error Type
typescript

## Error Message
Cannot find name 'x'

## Build Logs (excerpt)
```
  42 |   const value = x
     |                 ^
  Cannot find name 'x'.
```

## Affected Files
- src/components/App.tsx
- src/utils/helper.ts

## Instructions
1. Analyze the error and identify the root cause
2. Make the minimal necessary changes to fix the error
3. Ensure the fix doesn't break any existing functionality
4. Create a pull request with a descriptive title and body explaining the fix
```

---

### Step 3: Task Execution (OpenCode Agent)

The task created in Step 2.7 is picked up by the existing task execution system.

**Note**: The `createFixPr` Inngest function exists but is NOT automatically triggered. The current flow creates a task and relies on the user's task execution infrastructure to handle it.

**What should happen next**:
1. OpenCode agent picks up the task
2. Creates a sandbox with the repo
3. Analyzes the error
4. Makes code changes
5. Creates a PR
6. Updates task status

---

## Database Schema

### deployments table

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (fix_xxx) |
| `subscription_id` | text | FK to subscriptions |
| `platform_deployment_id` | text | Vercel deployment ID (unique) |
| `webhook_delivery_id` | text | Webhook delivery ID (unique, dedup) |
| `fix_status` | enum | `pending` → `analyzing` → `fixing` → `pr_created` / `failed` / `skipped` |
| `error_type` | enum | `typescript`, `dependency`, `config`, `runtime`, `build`, `other` |
| `error_message` | text | First error line |
| `error_context` | text | Relevant log excerpt |
| `logs` | text | Full build logs |
| `task_id` | text | FK to tasks (the fix task) |
| `pr_url` | text | URL of created PR |
| `pr_number` | integer | PR number |
| `fix_branch_name` | text | Branch name for fix |
| `fix_summary` | text | PR title |
| `fix_details` | text | PR body |
| `matched_rule_id` | text | FK to fix_rules if matched |
| `started_at` | timestamp | When fix started |
| `completed_at` | timestamp | When fix completed |

### Fix Status Flow

```
pending → analyzing → fixing → pr_created → merged
                     ↓
                   failed
         ↓
       skipped
```

---

## Inngest Event Types

**File**: `lib/inngest/events.ts`

```typescript
type Events = {
  // Triggered when webhook receives deployment error
  'deployment-failure/received': {
    data: {
      fixId: string
      subscriptionId: string
      deploymentId: string
      projectId: string
      webhookDeliveryId: string
    }
  }
  
  // Should be triggered when fix PR is created (currently NOT used)
  'deployment-fix/create-pr': {
    data: {
      deploymentId: string
      repoFullName: string
      branchName: string
      fixSummary: string
      fixDetails: string
    }
  }
}
```

---

## Current Gaps

### 1. Task → PR Flow Not Connected

After `handleDeploymentFailure` creates a task, the `createFixPr` function is NOT triggered. The task must be executed manually or through the existing task UI.

### 2. Missing: PR Creation Automation

The system needs to:
1. Execute the fix task via OpenCode
2. Monitor task completion
3. Trigger `createFixPr` event
4. Update deployment record with PR info

### 3. Missing: PR Merge Monitoring

When a PR is merged:
1. Update `fix_status` to `merged`
2. Set `completed_at`

---

## Summary Flow

```
1. Vercel Deployment Fails
   ↓
2. Webhook → /api/integrations/vercel/webhooks
   - Verify signature
   - Create deployment record (status: pending)
   - Send Inngest event
   ↓
3. Inngest: handle-deployment-failure
   - Update status: analyzing
   - Get subscription + integration
   - Fetch build logs from Vercel
   - Analyze logs (error type, message, context, files)
   - Check fix rules (skip? custom prompt?)
   - Create fix task
   - Update status: fixing
   ↓
4. Task Execution (OpenCode Agent)
   - Sandbox creation
   - Code analysis
   - Fix implementation
   - PR creation
   ↓
5. PR Created
   - Update deployment: pr_url, pr_number, status: pr_created
   ↓
6. PR Merged
   - Update deployment: status: merged, completed_at
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/inngest/client.ts` | Inngest client initialization |
| `lib/inngest/events.ts` | Event type definitions |
| `lib/inngest/functions/deployment/handle-deployment-failure.ts` | Main fix function |
| `lib/inngest/functions/deployment/create-fix-pr.ts` | PR creation (not connected) |
| `lib/integrations/vercel/deployment/analyzer.ts` | Log analysis |
| `lib/integrations/vercel/deployment/rules.ts` | Fix rule matching |
| `app/api/integrations/vercel/webhooks/route.ts` | Webhook handler |
| `app/api/inngest/route.ts` | Inngest serve endpoint |
