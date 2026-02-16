# Deployment Integration — Implementation Plan

## Objective

Build a deployment integration that supports multiple platforms (Vercel, Cloudflare, Render):

1. Users connect via guided manual token input (OAuth not available for external apps)
2. Receives deployment failure notifications from platforms via webhooks
3. Links projects to GitHub repos using getProjects() → link field
4. Analyzes build logs to identify and classify errors
5. Uses AI (OpenCode) to automatically fix the issues in a sandbox
6. Creates a pull request with the fix
7. Provides unified deployment view across all platforms

---

## Important: Why Manual Token?

**Vercel OAuth limitation:** Vercel's "Sign in with Vercel" only provides ID tokens (for login), NOT API access tokens. API permissions are in private beta. The only official way is Vercel Marketplace Integration, but users must install from Vercel's dashboard.

**Solution:** Manual token input with guided wizard - users create a Vercel API token and paste it into our app. We make this as easy as possible with step-by-step guidance.

---

## Architecture Overview

```
lib/integrations/
├── types.ts                       # Shared contracts (TokenProvider, ConnectionInfo)
├── registry.ts                    # Provider registry: Record<ProviderId, TokenProvider>
├── vercel/
│   ├── index.ts                   # TokenProvider implementation
│   ├── client.ts                  # Vercel API client
│   ├── token.ts                   # Token validation & user info
│   ├── webhooks.ts                # Webhook signature verification + parsing
│   └── deployment/
│       ├── types.ts               # Deployment types
│       ├── analyzer.ts            # Parse build logs, extract error context
│       ├── fixer.ts               # Orchestrate OpenCode fix
│       ├── pr-creator.ts         # Create PR via GitHub API
│       └── rules.ts              # Fix rules matching logic

app/api/integrations/
├── vercel/
│   ├── connect/route.ts           # POST - Validate token & save connection
│   ├── status/route.ts           # GET - Connection status
│   ├── disconnect/route.ts       # DELETE - Remove connection
│   ├── webhooks/route.ts         # POST - Vercel deployment webhooks
│   ├── projects/route.ts         # GET - List Vercel projects
│   ├── token/
│   │   ├── validate/route.ts     # POST - Validate token format
│   │   └── test/route.ts         # POST - Test token works
│   ├── subscriptions/
│   │   ├── route.ts              # GET/POST - List/Create subscriptions
│   │   └── [id]/route.ts        # PATCH/DELETE - Update/Remove
│   └── rules/
│       ├── route.ts              # GET/POST - List/Create fix rules
│       └── [id]/route.ts        # PATCH/DELETE - Update/Remove rule

app/api/deployments/
├── route.ts                      # GET - List deployments (unified, all platforms)
├── [id]/route.ts                 # GET - Deployment details + fix status
├── fix/route.ts                  # POST - Manual fix trigger

app/
├── integrations/
│   ├── page.tsx                  # List all integrations, connect buttons
│   └── vercel/
│       └── page.tsx             # Token wizard page for Vercel
├── deployments/
│   ├── page.tsx                 # Dashboard: Projects tab + Deployments tab (Success/Failed/Fixed)
│   └── [id]/page.ts             # Deployment detail page
└── repos/[owner]/[repo]/
    └── deployments/page.ts       # Deployments tab for repo (auto-filtered)

lib/inngest/functions/
├── deployment/
│   ├── handle-deployment-failure.ts  # Main orchestrator
│   ├── fetch-deployment-logs.ts      # Get logs from platform API
│   ├── analyze-error.ts             # Parse logs, classify error type
│   ├── run-fix.ts                  # Execute OpenCode in sandbox
│   └── create-fix-pr.ts            # Commit changes, create PR

components/
├── integrations/
│   ├── connect-button.tsx         # "Connect Vercel" button
│   ├── token-wizard/
│   │   ├── token-wizard-modal.tsx # Main wizard modal
│   │   ├── step-create-token.tsx  # Step 1: Guide to create token
│   │   ├── step-paste-token.tsx  # Step 2: Paste token
│   │   ├── step-verify.tsx        # Step 3: Verify token works
│   │   └── wizard-progress.tsx    # Progress indicator
│   ├── connection-card.tsx        # Show connection status
│   └── project-selector.tsx      # Select projects to monitor
├── deployments/
│   ├── dashboard/
│   │   ├── deployment-stats.tsx  # Stats cards
│   │   ├── deployments-list.tsx  # Unified list with platform badges
│   │   └── deployment-detail.tsx # Fix progress, PR link
│   └── shared/
│       ├── deployment-row.tsx    # Row with platform badge + status
│       └── fix-status-badge.tsx  # Fix status indicator
```

---

## User Flow

```
1. Connect Platform (Manual Token)
   /integrations → Connect Vercel
   → Redirects to /integrations/vercel (Token Wizard Page)
     Step 1: Introduction - what we'll do
     Step 2: Create Token - deep link + guide
     Step 3: Paste Token - user pastes
     Step 4: Verify - we validate, show success
   → Redirect back to /integrations

2. Create Sandbox (Automatic)
   • After successful connection, we create a sandbox environment using the user's Vercel token
   • The sandbox will be used to: clone the repo, reproduce the build error, fix it, and test
   • Sandbox is created per-fix or can be reused

3. Sync Projects & Create Webhooks (Auto)
   • Call getProjects() → Get all projects
   • For each project with link (GitHub repo):
     → Create subscription with githubRepoFullName = "${link.org}/${link.repo}"
     → Create webhook for deployment events on that project via Vercel API
   • Store subscription + webhookId in subscriptions table
   • Webhook URL: https://cloudcode1.vercel.app/api/integrations/vercel/webhooks
   • Events we subscribe to: deployment.error (for failures)

4. When Deployment Fails (Webhook)
   • Vercel sends webhook to our endpoint with projectId
   • Look up subscription by platformProjectId
   • We already know the repo from subscription!
   • Analyze error → OpenCode fixes → Create PR

5. User Views
   • Deployments Dashboard (fetch live data from API)
   • Repo → Deployments Tab: use withGitRepoInfo='true' to filter by repo
   • Click deployment → See fix progress + PR link

6. View Deployment Details
   • Fetch fresh data from Vercel API on demand using platformDeploymentId
   • Not stored in DB (except fix-related data)
```

---

## How Project → Repo Linking Works

When calling `getProjects()`, each project includes a `link` field which is a union of several provider types. We must narrow the type to get the correct repository full name.

```ts
import type { GetProjectsResponseBodyProjects } from '@vercel/sdk'

export function getRepoFullName(project: GetProjectsResponseBodyProjects): string | null {
  const { link } = project
  if (!link) return null

  switch (link.type) {
    case 'github':
    case 'github-limited':
      return link.org && link.repo ? `${link.org}/${link.repo}` : null
    case 'github-custom-host':
      return link.org && link.repo ? `${link.org}/${link.repo}` : null
    case 'gitlab':
      return link.projectNameWithNamespace ?? null
    case 'bitbucket':
      return link.name && link.slug ? `${link.name}/${link.slug}` : null
    default:
      return null
  }
}
```

**We use this helper to create subscriptions automatically when user connects a platform.**

---

## Database Schema

### integrations

Stores API token connections for deployment platforms (Vercel, Cloudflare, Render, etc.). This is separate from the `accounts` table which is for authentication providers only.

```ts
export const integrations = pgTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', {
      enum: ['vercel', 'cloudflare', 'render'],
    }).notNull(),
    externalUserId: text('external_user_id').notNull(), // Platform user ID
    accessToken: text('access_token').notNull(), // Encrypted
    refreshToken: text('refresh_token'), // Encrypted (if applicable)
    expiresAt: timestamp('expires_at'), // Token expiration
    username: text('username').notNull(), // Platform username
    teamId: text('team_id'), // Vercel Team ID (if applicable)
    tokenCreatedAt: timestamp('token_created_at'), // When user created token
    tokenNote: text('token_note'), // Optional note about token (e.g., "MyApp-Integration")
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('integrations_user_provider_idx').on(table.userId, table.provider),
  }),
)
```

### subscriptions

Links deployment platform projects to GitHub repos with fix settings. Platform-agnostic - works with any provider.

```ts
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    platformProjectId: text('platform_project_id').notNull(), // e.g., Vercel project ID
    platformProjectName: text('platform_project_name').notNull(),
    webhookId: text('webhook_id'), // Vercel webhook ID for this project
    webhookSecret: text('webhook_secret'), // Secret from createWebhook response (encrypted)
    githubRepoFullName: text('github_repo_full_name').notNull(), // "owner/repo" from getProjects().link
    autoFixEnabled: boolean('auto_fix_enabled').default(true).notNull(),
    fixBranchPrefix: text('fix_branch_prefix').default('fix/deployment-'),
    maxFixAttempts: integer('max_fix_attempts').default(3),
    notifyOnFix: boolean('notify_on_fix').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userProjectUnique: uniqueIndex('subscriptions_user_project_idx').on(
      table.userId,
      table.integrationId,
      table.platformProjectId,
    ),
  }),
)
```

### fix_rules

User-defined rules to customize or skip specific error patterns.

```ts
export const fixRules = pgTable(
  'fix_rules',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    errorPattern: text('error_pattern').notNull(), // Regex pattern
    errorType: text('error_type', {
      enum: ['typescript', 'dependency', 'config', 'runtime', 'build', 'other'],
    }),
    skipFix: boolean('skip_fix').default(false),
    customPrompt: text('custom_prompt'),
    priority: integer('priority').default(0),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    subscriptionIdx: index('fix_rules_subscription_idx').on(table.subscriptionId),
  }),
)
```

### deployments

Tracks only fix-related data for failed deployments. Deployment details (status, URL, branch, commit) are fetched from Vercel API on demand using `withGitRepoInfo` parameter for repo filtering.

**ARCHITECTURAL IMPROVEMENT:** Added `webhookDeliveryId` and `version` columns for idempotency and optimistic locking.

```ts
export const deployments = pgTable(
  'deployments',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    platformDeploymentId: text('platform_deployment_id').notNull(), // e.g., Vercel deployment ID
    webhookDeliveryId: text('webhook_delivery_id'), // Vercel webhook delivery ID for idempotency
    fixStatus: text('fix_status', {
      enum: ['pending', 'analyzing', 'fixing', 'reviewing', 'pr_created', 'merged', 'failed', 'skipped'],
    })
      .notNull()
      .default('pending'),
    fixAttemptNumber: integer('fix_attempt_number').default(1),
    version: integer('version').default(1).notNull(), // Optimistic locking version
    matchedRuleId: text('matched_rule_id').references(() => fixRules.id, { onDelete: 'set null' }),
    errorType: text('error_type', {
      enum: ['typescript', 'dependency', 'config', 'runtime', 'build', 'other'],
    }),
    errorMessage: text('error_message'),
    errorContext: text('error_context'),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    prUrl: text('pr_url'),
    prNumber: integer('pr_number'),
    fixBranchName: text('fix_branch_name'),
    fixSummary: text('fix_summary'),
    fixDetails: text('fix_details'),
    logs: text('logs'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    subscriptionIdx: index('deployments_subscription_idx').on(table.subscriptionId),
    // CRITICAL: Unique constraint prevents duplicate webhook processing
    platformDeploymentUnique: uniqueIndex('deployments_platform_deployment_idx').on(table.platformDeploymentId),
    // Idempotency: prevents processing same webhook delivery twice
    webhookDeliveryUnique: uniqueIndex('deployments_webhook_delivery_idx').on(table.webhookDeliveryId),
    fixStatusIdx: index('deployments_fix_status_idx').on(table.fixStatus),
  }),
)
```

**Note:** The `accounts` table should NOT be modified. It is for authentication providers only (GitHub login). Vercel and other deployment platforms go in the new `integrations` table.

---

## Token Wizard UX (Key Feature)

### Guided Token Wizard - Step by Step

**Step 1: Introduction**

- Modal opens with "Connect Vercel" explanation
- Shows what we'll be able to do: monitor deployments, auto-fix failures
- "Continue" button

**Step 2: Create Token (with deep link)**

- Clickable link: `https://vercel.com/account/settings/tokens`
- Animated GIF or screenshot showing:
  1. Click "Create Token"
  2. Name it (pre-filled suggestion)
  3. Set scope to "Full Account" (or show available scopes)
  4. Copy the token
- "I've created the token" button

**Step 3: Paste Token**

- Large text input, auto-focuses
- Real-time validation (format check)
- Show first few chars for verification
- "Connect" button

**Step 4: Verification**

- We call Vercel API to test token
- Fetch user info to display: "Connected as @username"
- Show success animation
- Auto-close modal

### Visual Design

```tsx
// Wizard Progress Indicator
<WizardProgress
  steps={['Introduction', 'Create Token', 'Paste Token', 'Verify']}
  currentStep={2}
/>

// Step: Create Token - with clickable link
<StepCreateToken>
  <Button
    variant="link"
    onClick={() => window.open('https://vercel.com/account/settings/tokens', '_blank')}
  >
    Click here to create token →
  </Button>

  // Animated screenshot/GIF
  <img src="/guides/vercel-create-token.gif" alt="Create token steps" />
</StepCreateToken>

// Step: Paste Token - with validation
<StepPasteToken>
  <Input
    placeholder="vl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    onChange={validateTokenFormat}
  />
  {isValidFormat && <CheckIcon />}
</StepPasteToken>
```

---

## Integration Implementation

### Step 1: Shared Types (lib/integrations/types.ts)

```ts
export interface TokenProvider {
  id: string
  name: string
  token: {
    createUrl: string // Deep link to create token
    validateUrl?: string
    scopes?: string[]
  }
  validateToken(accessToken: string): Promise<ProviderUser>
}

export interface ProviderUser {
  externalId: string
  username: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}

export interface ConnectionInfo {
  connected: boolean
  provider: string
  username?: string
  connectedAt?: Date
}
```

### Step 2: Vercel Provider (lib/integrations/vercel/index.ts)

```ts
import { Vercel } from '@vercel/sdk'
import type { TokenProvider, ProviderUser } from '../types'

export const vercelProvider: TokenProvider = {
  id: 'vercel',
  name: 'Vercel',

  token: {
    createUrl: 'https://vercel.com/account/settings/tokens',
    scopes: ['deployment', 'project', 'user'],
  },

  async validateToken(accessToken: string): Promise<ProviderUser> {
    const client = new Vercel({ bearerToken: accessToken })
    const response = await client.user.getAuthUser()

    if (!response?.user) {
      throw new Error('Invalid token')
    }

    const { user } = response

    return {
      externalId: user.id,
      username: user.username,
      email: user.email ?? null,
      name: user.name ?? null,
      avatarUrl: user.avatar ?? null,
    }
  },
}
```

### Step 3: Registry (lib/integrations/registry.ts)

```ts
import { vercelProvider } from './vercel'

export const providers = {
  vercel: vercelProvider,
} as const

export type ProviderId = keyof typeof providers
```

### Step 4: Vercel Client (lib/integrations/vercel/client.ts)

**ARCHITECTURAL IMPROVEMENT:** Proper handling of SDK discriminated union types and bounded log fetching.

```ts
import { Vercel } from '@vercel/sdk'
import { Events } from '@vercel/sdk/models/createwebhookop'
import type { GetDeploymentEventsResponseBody } from '@vercel/sdk/models/getdeploymenteventsop'
import { getUserVercelToken } from './token'

export async function getVercelClient(token?: string): Promise<Vercel> {
  const vercelToken = token || (await getUserVercelToken())
  if (!vercelToken) throw new Error('No Vercel token available')

  return new Vercel({ bearerToken: vercelToken })
}

export async function listVercelProjects(teamId?: string) {
  const client = await getVercelClient()
  const response = await client.projects.getProjects({ teamId })
  return response.projects || []
}

export async function getDeployment(deploymentId: string, teamId?: string) {
  const client = await getVercelClient()
  return client.deployments.getDeployment({ idOrUrl: deploymentId, teamId })
}

export async function getDeploymentEvents(deploymentId: string, teamId?: string) {
  const client = await getVercelClient()
  return client.deployments.getDeploymentEvents({
    idOrUrl: deploymentId,
    limit: 1000, // Bounded: Fetch last 1000 events only to prevent OOM
    direction: 'backward', // Start from the end (most recent)
    teamId,
  })
}

// SDK returns a discriminated union - we must handle both shapes
// Shape 1: { type: 'stdout'|..., text?: string, info: {...}, ... }
// Shape 2: { type: 'stdout'|..., payload: { text?: string, info?: {...} }, ... }
export function extractLogText(event: GetDeploymentEventsResponseBody): string {
  // Shape 1: text at top level
  if ('text' in event && typeof event.text === 'string') {
    return event.text
  }
  // Shape 2: text nested in payload
  if ('payload' in event && event.payload && typeof event.payload.text === 'string') {
    return event.payload.text
  }
  return ''
}

const LOG_EVENT_TYPES = ['stdout', 'stderr', 'command', 'fatal'] as const

export function isLogEvent(event: GetDeploymentEventsResponseBody | null): boolean {
  if (!event) return false
  if (!('type' in event)) return false
  return LOG_EVENT_TYPES.includes(event.type as (typeof LOG_EVENT_TYPES)[number])
}

export async function getBuildLogs(deploymentId: string, teamId?: string): Promise<string> {
  const response = await getDeploymentEvents(deploymentId, teamId)
  const events = Array.isArray(response) ? response : [response]

  // Vercel returns backward logs in reverse chronological order,
  // so we reverse them back to maintain readability for the AI.
  return events.filter(isLogEvent).reverse().map(extractLogText).filter(Boolean).join('\n')
}

export interface CreateWebhookResult {
  id: string
  secret: string
  url: string
  events: Events[]
  projectIds?: string[]
}

export interface CreateWebhookOptions {
  projectIds?: string[]
  events: Events[]
  teamId?: string
}

const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cloudcode1.vercel.app'

export async function createProjectWebhook(options: CreateWebhookOptions): Promise<CreateWebhookResult> {
  const client = await getVercelClient()
  const webhookUrl = `${WEBHOOK_BASE_URL}/api/integrations/vercel/webhooks`
  const result = await client.webhooks.createWebhook({
    teamId: options.teamId,
    requestBody: {
      url: webhookUrl,
      events: options.events,
      projectIds: options.projectIds,
    },
  })

  return {
    id: result.id,
    secret: result.secret,
    url: result.url,
    events: result.events,
    projectIds: result.projectIds,
  }
}

export async function deleteProjectWebhook(webhookId: string, teamId?: string) {
  const client = await getVercelClient()
  return client.webhooks.deleteWebhook({ id: webhookId, teamId })
}
```

### Step 5: Webhook Handler (lib/integrations/vercel/webhooks.ts)

```ts
import { createHmac } from 'crypto'
import { Events } from '@vercel/sdk/models/createwebhookop'

export type VercelWebhookEventType =
  | 'deployment.canceled'
  | 'deployment.created'
  | 'deployment.error'
  | 'deployment.ready'
  | 'deployment.succeeded'
  | 'deployment.promoted'
  | 'deployment-error'

export interface VercelWebhookPayload {
  type: VercelWebhookEventType
  payload: {
    deployment: {
      id: string
      url: string
      name: string
      meta?: Record<string, string>
    }
    project: {
      id: string
    }
    target?: string
    team?: {
      id: string
    }
    user: {
      id: string
    }
    links?: {
      deployment?: string
      project?: string
    }
  }
  id: string
  createdAt: string
  region?: string
}

export function verifyVercelWebhook(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false

  const hmac = createHmac('sha1', secret)
  hmac.update(body)
  const expected = `sha1=${hmac.digest('hex')}`

  try {
    return signature === expected
  } catch {
    return false
  }
}

export function parseWebhookPayload(body: string): VercelWebhookPayload {
  return JSON.parse(body)
}

export function isDeploymentFailure(payload: VercelWebhookPayload): boolean {
  return payload.type === 'deployment.error' || payload.type === 'deployment-error'
}

export const DEPLOYMENT_ERROR_EVENTS: Events[] = ['deployment.error']
```

### Step 6: Deployment Analyzer (lib/integrations/vercel/deployment/analyzer.ts)

```ts
export type ErrorType = 'typescript' | 'dependency' | 'config' | 'runtime' | 'build' | 'other'

export interface AnalysisResult {
  errorType: ErrorType
  errorMessage: string
  errorContext: string
  affectedFiles: string[]
  confidence: number
}

const ERROR_PATTERNS = {
  typescript: [
    /error TS\d+:/,
    /TypeError:/,
    /Cannot find (?:name|module) '/,
    /Property '.*' does not exist/,
    /Type '.*' is not assignable/,
  ],
  dependency: [
    /npm ERR! /,
    /ERESOLVE/,
    /peer dep/,
    /Cannot find module '.*'/,
    /Module not found:/,
    /Package '.*' not found/,
  ],
  config: [/next\.config\.js/, /Invalid configuration/, /Config error/, /Environment variable/],
  runtime: [/ReferenceError:/, /TypeError: Cannot read/, /Uncaught Error:/, /ENOENT:/],
  build: [/Build error/, /Failed to compile/, /Webpack error/, /Transform failed/],
}

export function analyzeBuildLogs(logs: string): AnalysisResult {
  const lines = logs.split('\n')

  const errorLines = lines.filter(
    (line) => line.toLowerCase().includes('error') || line.includes('failed') || line.includes('fatal'),
  )

  let errorType: ErrorType = 'other'
  let maxMatches = 0

  for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
    let matches = 0
    for (const pattern of patterns) {
      if (pattern.test(logs)) {
        matches++
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches
      errorType = type as ErrorType
    }
  }

  const errorContext = extractErrorContext(lines, errorLines)
  const affectedFiles = extractAffectedFiles(logs)
  const errorMessage = errorLines[0] || 'Unknown build error'

  return {
    errorType,
    errorMessage,
    errorContext,
    affectedFiles,
    confidence: maxMatches > 0 ? Math.min(maxMatches / 2, 1) : 0.3,
  }
}

function extractErrorContext(lines: string[], errorLines: string[]): string {
  const errorIndex = lines.findIndex((line) => errorLines.includes(line))
  if (errorIndex === -1) return lines.slice(-50).join('\n')

  const start = Math.max(0, errorIndex - 10)
  const end = Math.min(lines.length, errorIndex + 20)
  return lines.slice(start, end).join('\n')
}

function extractAffectedFiles(logs: string): string[] {
  const filePattern = /(?:at\s+)?(?:['"])?([\/\w.-]+\.(?:ts|tsx|js|jsx|json))['"]?/g
  const files = new Set<string>()
  let match
  while ((match = filePattern.exec(logs)) !== null) {
    files.add(match[1])
  }
  return Array.from(files).slice(0, 10)
}
```

### Step 7: Fix Rules Matching (lib/integrations/vercel/deployment/rules.ts)

```ts
import { db } from '@/lib/db/client'
import { fixRules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { AnalysisResult } from './analyzer'

export interface MatchedRule {
  id: string
  name: string
  skipFix: boolean
  customPrompt?: string | null
}

export async function findMatchingRule(subscriptionId: string, analysis: AnalysisResult): Promise<MatchedRule | null> {
  const rules = await db
    .select()
    .from(fixRules)
    .where(and(eq(fixRules.subscriptionId, subscriptionId), eq(fixRules.enabled, true)))
    .orderBy(fixRules.priority)

  for (const rule of rules) {
    try {
      const pattern = new RegExp(rule.errorPattern, 'i')
      if (pattern.test(analysis.errorMessage) || pattern.test(analysis.errorContext)) {
        return {
          id: rule.id,
          name: rule.name,
          skipFix: rule.skipFix,
          customPrompt: rule.customPrompt,
        }
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return null
}
```

---

## API Routes Implementation

### Connect (Token Input) - app/api/integrations/vercel/connect/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/integrations/registry'
import { connectionManager } from '@/lib/integrations/connection-manager'
import { encrypt } from '@/lib/crypto'
import { getServerSession } from '@/lib/session/get-server-session'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { token } = await req.json()

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Valid token is required' }, { status: 400 })
  }

  const provider = providers.vercel

  // Validate token works
  let userInfo
  try {
    userInfo = await provider.validateToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token or token expired' }, { status: 400 })
  }

  // Store connection
  await connectionManager.connect(userId, 'vercel', token, userInfo)

  return NextResponse.json({
    success: true,
    username: userInfo.username,
  })
}
```

### Token Validate - app/api/integrations/vercel/token/validate/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/integrations/registry'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token || token.length < 10) {
    return NextResponse.json({ valid: false, error: 'Valid token required' })
  }

  // Try to validate with API
  try {
    const provider = providers.vercel
    const userInfo = await provider.validateToken(token)
    return NextResponse.json({
      valid: true,
      username: userInfo.username,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Token is invalid or expired' })
  }
}
```

### Disconnect - app/api/integrations/vercel/disconnect/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { connectionManager } from '@/lib/integrations/connection-manager'

export async function DELETE(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectionManager.disconnect(session.user.id, 'vercel')

  return NextResponse.json({ success: true })
}
```

### Webhook Handler - app/api/integrations/vercel/webhooks/route.ts

**ARCHITECTURAL IMPROVEMENTS:**

1. Uses `webhookDeliveryId` (Vercel's `payload.id`) as idempotency key
2. Uses `ON CONFLICT DO NOTHING` for atomic duplicate detection
3. Adds Inngest idempotency for event deduplication
4. Logs key events for observability

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyVercelWebhook, parseWebhookPayload, isDeploymentFailure } from '@/lib/integrations/vercel/webhooks'
import { db } from '@/lib/db/client'
import { subscriptions, deployments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { nanoid } from 'nanoid'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-vercel-webhook-signature') || ''

  const payload = parseWebhookPayload(body)

  // Log webhook received (static message only)
  console.log('Webhook received', { eventType: payload.type })

  if (!isDeploymentFailure(payload)) {
    return NextResponse.json({ received: true, action: 'ignored' })
  }

  const deploymentId = payload.payload.deployment.id
  const projectId = payload.payload.project.id
  const webhookDeliveryId = payload.id // Vercel's unique webhook delivery ID

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.platformProjectId, projectId))
  const subscription = subs[0]

  if (!subscription || !subscription.autoFixEnabled) {
    return NextResponse.json({ received: true, action: 'no_subscription' })
  }

  // Verify webhook signature using secret stored from createWebhook response
  if (!subscription.webhookSecret) {
    console.error('Webhook secret not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const webhookSecret = decrypt(subscription.webhookSecret)
  if (!verifyVercelWebhook(body, signature, webhookSecret)) {
    console.error('Invalid webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // IDEMPOTENCY: Use ON CONFLICT DO NOTHING for atomic duplicate detection
  // This prevents race conditions when duplicate webhooks arrive simultaneously
  const fixId = nanoid()

  try {
    await db
      .insert(deployments)
      .values({
        id: fixId,
        subscriptionId: subscription.id,
        platformDeploymentId: deploymentId,
        webhookDeliveryId: webhookDeliveryId, // Store for audit/debugging
        fixStatus: 'pending',
      })
      .onConflictDoNothing({
        target: deployments.platformDeploymentId,
      })
  } catch (error) {
    // Insert failed - likely a duplicate
    console.log('Duplicate webhook detected')
    return NextResponse.json({ received: true, action: 'duplicate' })
  }

  // Send to Inngest with idempotency key
  // Inngest will not process the same event twice within 24 hours
  await inngest.send(
    {
      name: 'deployment-failure/received',
      data: {
        fixId,
        subscriptionId: subscription.id,
        deploymentId,
        projectId,
        webhookDeliveryId,
      },
    },
    {
      idempotency: {
        key: `vercel-webhook:${webhookDeliveryId}`,
        expiresIn: '24h',
      },
    },
  )

  console.log('Fix queued', { fixId })
  return NextResponse.json({ received: true, action: 'queued', fixId })
}
```

---

## UI Components

### Token Wizard Modal (components/integrations/token-wizard/token-wizard-modal.tsx)

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WizardProgress } from './wizard-progress'
import { StepIntroduction } from './step-introduction'
import { StepCreateToken } from './step-create-token'
import { StepPasteToken } from './step-paste-token'
import { StepVerify } from './step-verify'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface TokenWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: 'vercel' | 'cloudflare' | 'render'
  onSuccess?: (username: string) => void
}

const STEPS = ['Introduction', 'Create Token', 'Paste Token', 'Verify']

export function TokenWizardModal({ open, onOpenChange, provider, onSuccess }: TokenWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [token, setToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePaste = async () => {
    setVerifying(true)
    setError(null)

    try {
      const res = await fetch(`/api/integrations/${provider}/token/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!data.valid) {
        setError(data.error || 'Invalid token')
        return
      }

      // Save connection
      const saveRes = await fetch(`/api/integrations/${provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const saveData = await saveRes.json()

      if (!saveData.success) {
        setError(saveData.error || 'Failed to save token')
        return
      }

      setUsername(data.username)
      setCurrentStep(3)
      onSuccess?.(data.username)
    } catch (err) {
      setError('Failed to verify token')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Connect to {provider.charAt(0).toUpperCase() + provider.slice(1)}</DialogTitle>
        </DialogHeader>

        <WizardProgress steps={STEPS} currentStep={currentStep} />

        <div className="mt-6">
          {currentStep === 0 && <StepIntroduction provider={provider} onContinue={() => setCurrentStep(1)} />}
          {currentStep === 1 && <StepCreateToken provider={provider} onContinue={() => setCurrentStep(2)} />}
          {currentStep === 2 && (
            <StepPasteToken
              token={token}
              onChange={setToken}
              error={error}
              loading={verifying}
              onConnect={handlePaste}
            />
          )}
          {currentStep === 3 && <StepVerify username={username} onDone={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Step: Create Token (components/integrations/token-wizard/step-create-token.tsx)

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface StepCreateTokenProps {
  provider: 'vercel' | 'cloudflare' | 'render'
  onContinue: () => void
}

const PROVIDER_LINKS = {
  vercel: 'https://vercel.com/account/tokens',
  cloudflare: 'https://dash.cloudflare.com/profile/api-tokens',
  render: 'https://dashboard.render.com/api-keys',
}

export function StepCreateToken({ provider, onContinue }: StepCreateTokenProps) {
  const createUrl = PROVIDER_LINKS[provider]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Create an API Token</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Click the button below to create a new API token for {provider}.
        </p>
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <a href={createUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Create {provider.charAt(0).toUpperCase() + provider.slice(1)} Token
          </a>
        </Button>
      </div>

      <div className="bg-muted rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">When creating your token:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            Name it something like <code>Cloudcode-AutoFix</code>
          </li>
          <li>
            Grant <strong>Full Account</strong> access
          </li>
          <li>Set an expiration (or none for permanent)</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} variant="outline">
          I've created the token →
        </Button>
      </div>
    </div>
  )
}
```

### Step: Paste Token (components/integrations/token-wizard/step-paste-token.tsx)

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface StepPasteTokenProps {
  token: string
  onChange: (value: string) => void
  error: string | null
  loading: boolean
  onConnect: () => void
}

export function StepPasteToken({ token, onChange, error, loading, onConnect }: StepPasteTokenProps) {
  const isValidFormat = token.startsWith('vl_') || token.length > 10

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Paste Your Token</h3>
        <p className="text-sm text-muted-foreground mt-2">Copy the token you just created and paste it below.</p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Input
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="vl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono pr-10"
            autoFocus
          />
          {isValidFormat && !error && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onConnect} disabled={!token || !isValidFormat || loading}>
          {loading ? 'Verifying...' : 'Connect'}
        </Button>
      </div>
    </div>
  )
}
```

### Step: Verify (components/integrations/token-wizard/step-verify.tsx)

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

interface StepVerifyProps {
  username: string | null
  onDone: () => void
}

export function StepVerify({ username, onDone }: StepVerifyProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Successfully Connected!</h3>
        <p className="text-sm text-muted-foreground mt-2">Connected to {username ? `@${username}` : 'your account'}</p>
      </div>

      <Button onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  )
}
```

### Wizard Progress (components/integrations/token-wizard/wizard-progress.tsx)

```tsx
'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardProgressProps {
  steps: string[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              index < currentStep
                ? 'bg-primary text-primary-foreground'
                : index === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <span
            className={cn(
              'ml-2 text-sm hidden sm:inline',
              index === currentStep ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div className={cn('mx-4 h-0.5 w-8 sm:w-16', index < currentStep ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  )
}
```

### Integration Card (components/integrations/connection-card.tsx)

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Unplug, RefreshCw } from 'lucide-react'
import { TokenWizardModal } from './token-wizard/token-wizard-modal'

interface ConnectionCardProps {
  provider: 'vercel' | 'cloudflare' | 'render'
  name: string
  connected: boolean
  username?: string
  onDisconnect?: () => void
}

export function ConnectionCard({ provider, name, connected, username, onDisconnect }: ConnectionCardProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <CardDescription>
              {connected ? 'Monitor and auto-fix deployments' : 'Connect to get started'}
            </CardDescription>
          </div>
          {connected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">as</span>
                <span className="font-medium">@{username}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm" onClick={onDisconnect}>
                  <Unplug className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setWizardOpen(true)} className="w-full">
              Connect {name}
            </Button>
          )}
        </CardContent>
      </Card>

      <TokenWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        provider={provider}
        onSuccess={() => {
          // Refresh connection status
        }}
      />
    </>
  )
}
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

- [ ] Create `lib/integrations/types.ts` with TokenProvider interface
- [ ] Create `lib/integrations/registry.ts` with provider registry
- [ ] Create `lib/integrations/connection-manager.ts` for DB operations
- [ ] Create `lib/db/schema.ts` with new tables: `integrations`, `subscriptions`, `deployments`, `fix_rules`
- [ ] Generate migration with `pnpm drizzle-kit generate`

### Phase 2: Token Provider (Days 2-3)

- [ ] Create `lib/integrations/vercel/index.ts` (TokenProvider)
- [ ] Create `lib/integrations/vercel/client.ts` (API client)
- [ ] Create `lib/integrations/vercel/token.ts` (token resolution)
- [ ] Create API routes: connect, disconnect, status, token/validate, token/test
- [ ] Add environment variables: (none needed for manual token)

### Phase 3: Database Schema (Day 3)

- [ ] Run migration on development database
- [ ] Verify tables created correctly

### Phase 4: Token Wizard UI (Days 3-4)

- [ ] Create token-wizard-modal component
- [ ] Create wizard-progress component
- [ ] Create step-introduction component
- [ ] Create step-create-token component (with deep links)
- [ ] Create step-paste-token component
- [ ] Create step-verify component
- [ ] Create connection-card component

### Phase 5: Webhooks & Analysis (Days 5-6)

- [ ] Create webhook verification in `lib/integrations/vercel/webhooks.ts`
- [ ] Create `lib/integrations/vercel/deployment/types.ts`
- [ ] Create `lib/integrations/vercel/deployment/analyzer.ts`
- [ ] Create `lib/integrations/vercel/deployment/rules.ts`
- [ ] Create webhook route handler
- [ ] Add `VERCEL_WEBHOOK_SECRET` environment variable

### Phase 6: Inngest Pipeline (Days 6-8)

- [ ] Create Inngest event types for deployment failures
- [ ] Create `handle-deployment-failure.ts` orchestrator
- [ ] Create `fetch-deployment-logs.ts` function
- [ ] Create `analyze-error.ts` function
- [ ] Create `run-fix.ts` function (integrates with sandbox)
- [ ] Create `create-fix-pr.ts` function

### Phase 7: API Routes (Days 8-9)

- [ ] Create projects list route (per integration)
- [ ] Create subscriptions CRUD routes
- [ ] Create deployments list route (unified across platforms)
- [ ] Create deployment details route
- [ ] Create manual fix trigger route
- [ ] Create fix rules CRUD routes

### Phase 8: UI Dashboard (Days 9-11)

- [ ] Create deployments dashboard page with tabs: Projects, Deployments (Success/Failed/Fixed)
- [ ] Create deployment-stats component
- [ ] Create deployments-list component (unified, with platform badges)
- [ ] Create deployment-detail page (shows fix progress, PR link)
- [ ] Add "Deployments" to sidebar navigation

### Phase 9: Repo Integration (Days 11-12)

- [ ] Create deployments tab for repo pages
- [ ] Query deployments by repo URL (auto-detected from platform)
- [ ] Create deployment-row component with platform badge
- [ ] Show fix status in deployment rows

### Phase 10: Integrations Page & Sandbox (Days 12-13)

- [ ] Create /integrations page with connection cards
- [ ] Create /integrations/vercel token wizard page
- [ ] Create connect-button for Vercel (redirects to token wizard)
- [ ] Create project-subscriptions component
- [ ] Auto-linking: system automatically links projects to repos based on git info
- [ ] Create manual-fix-button component
- [ ] Implement sandbox creation using user's Vercel token

### Phase 11: Testing & Polish (Days 14-15)

- [ ] Test token input flow end-to-end
- [ ] Test webhook handling with Vercel test deployments
- [ ] Test fix pipeline with intentional build errors
- [ ] Run `pnpm type-check`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm format`
- [ ] Run `pnpm build`

---

## Checklist Before Merging

- [ ] Provider implements `TokenProvider` interface
- [ ] Provider is registered in `registry.ts`
- [ ] DB schema updated with new tables (`integrations`, `subscriptions`, `deployments`, `fix_rules`) + migration generated
- [ ] `deployments.platformDeploymentId` has UNIQUE constraint for idempotency
- [ ] `deployments.webhookDeliveryId` column added for webhook idempotency tracking
- [ ] `deployments.version` column added for optimistic locking
- [ ] `subscriptions.webhookSecret` column added for storing webhook secrets
- [ ] Token validation routes created (validate, test, connect, disconnect, status)
- [ ] All tokens and webhook secrets encrypted before storage (use `encrypt()` from `lib/crypto`)
- [ ] Token wizard UI complete with all steps
- [ ] Deep links to token creation pages working
- [ ] Webhook creation via Vercel API when subscribing to projects (store returned `secret`)
- [ ] Webhook deletion when unsubscribing
- [ ] Webhook signature verification using DB-stored secret (not env var)
- [ ] Webhook handler uses `ON CONFLICT DO NOTHING` for atomic duplicate detection
- [ ] Inngest events use idempotency key (`vercel-webhook:{webhookDeliveryId}`)
- [ ] `getBuildLogs()` uses bounded limit (1000) instead of `-1`
- [ ] Log extraction handles SDK discriminated union types correctly
- [ ] No dynamic values in log statements (static strings only)
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes (0 errors)
- [ ] `pnpm format` applied
- [ ] `pnpm build` succeeds

---

## Environment Variables

```env
# Base URL for webhooks (should be set in Vercel project settings)
NEXT_PUBLIC_BASE_URL=https://cloudcode1.vercel.app
```

**Note:** Webhook secrets are NOT stored in environment variables. They are returned by the Vercel API when creating webhooks and stored encrypted in the `subscriptions.webhookSecret` column.

---

## Notes

- **Token-based connection** is the only way to connect external apps to Vercel
- **Guided wizard** makes token input painless
- **Deep links** help users find the token creation page quickly
- **Token encryption**: All tokens and webhook secrets are encrypted using AES-256-CBC before storing in DB via `encrypt()` from `lib/crypto.ts`, decrypted only when needed via `decrypt()`
- **Webhook secret storage**: The `secret` returned from `createWebhook()` is stored in `subscriptions.webhookSecret` (encrypted), NOT in environment variables
- **getProjects() is the source of truth** for project → repo mapping
- Only store fix-related data in deployments table (not deployment details like URL, status, branch, commit)
- When user views deployment, fetch fresh data from Vercel API using `platformDeploymentId`
- For Repo → Deployments Tab: use `withGitRepoInfo='true'` parameter to filter by repo
- GitHub PR creation uses the existing `lib/github/client.ts` functions
- Manual fix triggers allow user control while auto-fix handles the common case
- Fix rules provide granular control per project and error pattern
