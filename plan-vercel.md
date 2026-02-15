# Vercel Build Fix Integration — Implementation Plan

## Objective

Build a Vercel integration that:

1. Receives deployment failure notifications from Vercel via webhooks
2. Analyzes build logs to identify and classify errors
3. Uses AI (OpenCode) to automatically fix the issues in a sandbox
4. Creates a pull request with the fix
5. Provides manual override, fix rules, and cross-project management

---

## Architecture Overview

```
lib/integrations/
├── types.ts                       # Shared contracts (OAuthProvider, ConnectionInfo)
├── connection-manager.ts          # Generic connect/disconnect/status DB logic
├── token-resolver.ts              # Generic token resolution
├── registry.ts                    # Provider registry: Record<ProviderId, OAuthProvider>
├── github/
│   ├── index.ts                   # OAuthProvider implementation
│   ├── client.ts                  # Octokit wrapper
│   ├── user-token.ts              # GitHub token resolution
│   └── actions.ts                 # PR create/merge, repos
├── vercel/
│   ├── index.ts                   # OAuthProvider implementation
│   ├── client.ts                  # Vercel API client
│   ├── user-token.ts              # Vercel token resolution
│   ├── webhooks.ts                # Webhook signature verification + parsing
│   └── build-fix/
│       ├── types.ts               # BuildFixEvent, BuildFixResult, ErrorType
│       ├── analyzer.ts            # Parse build logs, extract error context
│       ├── fixer.ts               # Orchestrate OpenCode fix
│       ├── pr-creator.ts          # Create PR via GitHub API
│       └── rules.ts               # Fix rules matching logic
└── components/
    ├── connect-button.tsx         # Generic connect/disconnect button
    └── connection-status.tsx      # Generic connection status badge

app/api/[integrations]/vercel/
├── auth/
│   ├── signin/route.ts            # Initiate Vercel OAuth
│   ├── callback/route.ts         # Handle OAuth callback
│   ├── status/route.ts            # GET connection status
│   └── disconnect/route.ts       # DELETE connection
├── webhooks/route.ts             # POST - Vercel deployment webhooks
├── projects/route.ts             # GET - List Vercel projects
├── subscriptions/
│   ├── route.ts                  # GET/POST - List/Create subscriptions
│   └── [id]/route.ts             # PATCH/DELETE - Update/Remove
├── deployments/route.ts          # GET - List deployments with status
├── fixes/
│   ├── route.ts                  # GET - List fix history
│   └── [id]/route.ts             # GET - Fix details
├── fix/
│   └── route.ts                  # POST - Manual fix trigger
└── rules/
    ├── route.ts                  # GET/POST - List/Create fix rules
    └── [id]/route.ts             # PATCH/DELETE - Update/Remove rule

app/
├── build-fixes/
│   ├── page.tsx                   # Dashboard: stats + active issues + recent fixes
│   ├── fixes/
│   │   └── page.tsx              # All fixes list with filters
│   └── [project]/
│       └── page.tsx              # Fix history for specific project
├── repos/[owner]/[repo]/
│   └── deployments/page.tsx      # Deployments tab for repo
└── settings/
    ├── page.tsx                  # Add Vercel card
    └── vercel/
        └── page.tsx              # Vercel config (projects, rules, account)

lib/inngest/functions/build-fixes/
├── handle-build-failure.ts       # Main orchestrator
├── fetch-build-logs.ts           # Get logs from Vercel API
├── analyze-error.ts              # Parse logs, classify error type
├── run-fix.ts                    # Execute OpenCode in sandbox
└── create-fix-pr.ts              # Commit changes, create PR

components/build-fixes/
├── dashboard/
│   ├── build-fix-stats.tsx        # Stats cards
│   ├── active-issues-list.tsx    # Pending/in-progress fixes
│   └── recent-completions.tsx    # Completed fixes feed
├── shared/
│   ├── fix-card.tsx              # Fix item (used in multiple places)
│   ├── fix-status-badge.tsx      # Status indicator
│   ├── deployment-row.tsx        # Deployment with fix status
│   └── error-preview.tsx         # Error message preview
├── settings/
│   ├── vercel-account-card.tsx    # Connection status
│   ├── project-subscriptions.tsx # Project table
│   ├── project-linker-dialog.tsx # Link Vercel project to GitHub repo
│   └── fix-rules-editor.tsx      # Rules configuration
└── actions/
    ├── manual-fix-button.tsx     # Trigger fix manually
    ├── cancel-fix-button.tsx     # Cancel in-progress fix
    └── retry-fix-button.tsx      # Retry failed fix
```

---

## Database Schema

### vercel_subscriptions

Links Vercel projects to GitHub repos with fix settings.

```ts
export const vercelSubscriptions = pgTable(
  'vercel_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vercelProjectId: text('vercel_project_id').notNull(),
    vercelProjectName: text('vercel_project_name').notNull(),
    githubRepoUrl: text('github_repo_url').notNull(),
    autoFixEnabled: boolean('auto_fix_enabled').default(true).notNull(),
    fixBranchPrefix: text('fix_branch_prefix').default('fix/build-'),
    maxFixAttempts: integer('max_fix_attempts').default(3),
    notifyOnFix: boolean('notify_on_fix').default(true),
    branchMapping: jsonb('branch_mapping').$type<Record<string, string>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userProjectUnique: uniqueIndex('vercel_subscriptions_user_project_idx').on(table.userId, table.vercelProjectId),
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
    subscriptionId: text('subscription_id').references(() => vercelSubscriptions.id, { onDelete: 'cascade' }),
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

### build_fixes

Tracks all fix attempts with full history.

```ts
export const buildFixes = pgTable(
  'build_fixes',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => vercelSubscriptions.id, { onDelete: 'cascade' }),
    deploymentId: text('deployment_id').notNull(),
    deploymentUrl: text('deployment_url'),
    branchName: text('branch_name'),
    commitSha: text('commit_sha'),
    errorMessage: text('error_message'),
    errorType: text('error_type', {
      enum: ['typescript', 'dependency', 'config', 'runtime', 'build', 'other'],
    }),
    errorContext: text('error_context'), // Extracted relevant lines
    matchedRuleId: text('matched_rule_id').references(() => fixRules.id, { onDelete: 'set null' }),
    status: text('status', {
      enum: [
        'pending',
        'queued',
        'analyzing',
        'fixing',
        'reviewing',
        'pr_created',
        'merged',
        'failed',
        'skipped',
        'cancelled',
      ],
    })
      .notNull()
      .default('pending'),
    attemptNumber: integer('attempt_number').default(1),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    prUrl: text('pr_url'),
    prNumber: integer('pr_number'),
    fixBranchName: text('fix_branch_name'),
    fixSummary: text('fix_summary'),
    fixDetails: text('fix_details'), // AI explanation of fix
    logs: text('logs'), // Raw build logs
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    subscriptionIdx: index('build_fixes_subscription_idx').on(table.subscriptionId),
    deploymentIdx: index('build_fixes_deployment_idx').on(table.deploymentId),
    statusIdx: index('build_fixes_status_idx').on(table.status),
  }),
)
```

### accounts (existing table - add 'vercel' to enum)

```ts
provider: text('provider', {
  enum: ['github', 'vercel'], // Add 'vercel'
}).notNull(),
```

### keys (existing table - add 'vercel' to enum)

```ts
provider: text('provider', {
  enum: ['anthropic', 'openai', ..., 'vercel'], // Add 'vercel'
}).notNull(),
```

---

## Integration Implementation

### Step 1: Shared Types (lib/integrations/types.ts)

```ts
export interface OAuthProvider {
  id: string
  name: string
  oauth: {
    authorizeUrl: string
    tokenUrl: string
    scopes: string[]
    clientIdEnv: string
    clientSecretEnv: string
    usePKCE?: boolean
  }
  getUser(accessToken: string): Promise<ProviderUser>
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
import type { OAuthProvider } from '../types'

export const vercelProvider: OAuthProvider = {
  id: 'vercel',
  name: 'Vercel',

  oauth: {
    authorizeUrl: 'https://vercel.com/oauth/authorize',
    tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
    scopes: ['deployment', 'project', 'user'],
    clientIdEnv: 'VERCEL_CLIENT_ID',
    clientSecretEnv: 'VERCEL_CLIENT_SECRET',
    usePKCE: false,
  },

  async getUser(accessToken: string) {
    const res = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return {
      externalId: data.id,
      username: data.username,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatar,
    }
  },
}
```

### Step 3: Registry (lib/integrations/registry.ts)

```ts
import { githubProvider } from './github'
import { vercelProvider } from './vercel'

export const providers = {
  github: githubProvider,
  vercel: vercelProvider,
} as const

export type ProviderId = keyof typeof providers
```

### Step 4: Vercel Client (lib/integrations/vercel/client.ts)

```ts
import { Vercel } from '@vercel/sdk'
import { getUserVercelToken } from './user-token'

let vercelClient: Vercel | null = null

export async function getVercelClient(): Promise<Vercel> {
  if (vercelClient) return vercelClient

  const token = await getUserVercelToken()
  if (!token) throw new Error('No Vercel token available')

  vercelClient = new Vercel({ bearerToken: token })
  return vercelClient
}

export async function listVercelProjects() {
  const client = await getVercelClient()
  const response = await client.projects.retrieveProjects({})
  return response.projects || []
}

export async function getDeployment(deploymentId: string) {
  const client = await getVercelClient()
  return client.deployments.getDeployment({ idOrUrl: deploymentId })
}

export async function getDeploymentEvents(deploymentId: string) {
  const client = await getVercelClient()
  return client.deployments.getDeploymentEvents({
    idOrUrl: deploymentId,
    limit: -1,
  })
}

export async function getBuildLogs(deploymentId: string): Promise<string> {
  const events = await getDeploymentEvents(deploymentId)
  if (!events || !events.events) return ''
  return (events.events as any[])
    .filter((e) => e.type === 'stdout' || e.type === 'stderr' || e.type === 'command' || e.type === 'fatal')
    .map((e) => e.payload?.text || '')
    .join('\n')
}
```

### Step 5: Webhook Handler (lib/integrations/vercel/webhooks.ts)

```ts
import { createHmac } from 'crypto'

export interface VercelWebhookPayload {
  type:
    | 'deployment.canceled'
    | 'deployment.created'
    | 'deployment.error'
    | 'deployment.ready'
    | 'deployment.succeeded'
    | 'deployment.promoted'
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
  const hmac = createHmac('sha1', secret)
  hmac.update(body)
  const expected = `sha1=${hmac.digest('hex')}`
  return signature === expected
}

export function parseWebhookPayload(body: string): VercelWebhookPayload {
  return JSON.parse(body)
}

export function isDeploymentFailure(payload: VercelWebhookPayload): boolean {
  return payload.type === 'deployment.error'
}
```

### Step 6: Build Fix Analyzer (lib/integrations/vercel/build-fix/analyzer.ts)

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

  // Find error lines
  const errorLines = lines.filter(
    (line) => line.toLowerCase().includes('error') || line.includes('failed') || line.includes('fatal'),
  )

  // Classify error type
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

  // Extract error context (surrounding lines)
  const errorContext = extractErrorContext(lines, errorLines)

  // Extract affected files
  const affectedFiles = extractAffectedFiles(logs)

  // Get primary error message
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

### Step 7: Fix Rules Matching (lib/integrations/vercel/build-fix/rules.ts)

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

### OAuth Signin (app/api/[integrations]/vercel/auth/signin/route.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { providers } from '@/lib/integrations/registry'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provider = providers.vercel
  const state = nanoid(32)
  const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/settings/vercel'

  // Store state and userId in cookies for callback verification
  const cookieStore = await cookies()
  cookieStore.set('vercel_oauth_state', state, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
  })
  cookieStore.set('vercel_oauth_redirect_to', redirectTo, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
  })
  cookieStore.set('vercel_oauth_user_id', session.user.id, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
  })

  const clientId = process.env[provider.oauth.clientIdEnv]
  const authorizeUrl = new URL(provider.oauth.authorizeUrl)
  authorizeUrl.searchParams.set('client_id', clientId!)
  authorizeUrl.searchParams.set('redirect_uri', `${req.nextUrl.origin}/api/integrations/vercel/auth/callback`)
  authorizeUrl.searchParams.set('scope', provider.oauth.scopes.join(' '))
  authorizeUrl.searchParams.set('state', state)

  return NextResponse.redirect(authorizeUrl.toString())
}
```

### OAuth Callback (app/api/[integrations]/vercel/auth/callback/route.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/integrations/registry'
import { connectionManager } from '@/lib/integrations/connection-manager'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('vercel_oauth_state')?.value
  const redirectTo = cookieStore.get('vercel_oauth_redirect_to')?.value || '/settings/vercel'
  const userId = cookieStore.get('vercel_oauth_user_id')?.value

  if (!code || !state || state !== storedState || !userId) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 })
  }

  const provider = providers.vercel
  const clientId = process.env[provider.oauth.clientIdEnv]
  const clientSecret = process.env[provider.oauth.clientSecretEnv]

  // Exchange code for token
  const tokenRes = await fetch(provider.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: `${req.nextUrl.origin}/api/integrations/vercel/auth/callback`,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Failed to get access token' }, { status: 400 })
  }

  // Get user info
  const userInfo = await provider.getUser(tokenData.access_token)

  // Store connection
  await connectionManager.connect(userId, 'vercel', tokenData.access_token, userInfo)

  // Clean up cookies
  cookieStore.delete('vercel_oauth_state')
  cookieStore.delete('vercel_oauth_redirect_to')
  cookieStore.delete('vercel_oauth_user_id')

  return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin))
}
```

### Webhook Handler (app/api/[integrations]/vercel/webhooks/route.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyVercelWebhook, parseWebhookPayload, isDeploymentFailure } from '@/lib/integrations/vercel/webhooks'
import { db } from '@/lib/db/client'
import { vercelSubscriptions, buildFixes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-vercel-webhook-signature') || ''
  const secret = process.env.VERCEL_WEBHOOK_SECRET!

  if (!verifyVercelWebhook(body, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = parseWebhookPayload(body)

  // Only process deployment failures
  if (!isDeploymentFailure(payload)) {
    return NextResponse.json({ received: true, action: 'ignored' })
  }

  const deploymentId = payload.payload.deployment.id
  const projectId = payload.payload.project.id
  const deploymentUrl = payload.payload.deployment.url

  // Find matching subscription
  const subscriptions = await db
    .select()
    .from(vercelSubscriptions)
    .where(eq(vercelSubscriptions.vercelProjectId, projectId))

  const subscription = subscriptions[0]

  if (!subscription || !subscription.autoFixEnabled) {
    return NextResponse.json({ received: true, action: 'no_subscription' })
  }

  // Check for duplicate fix attempt
  const existingFix = await db.select().from(buildFixes).where(eq(buildFixes.deploymentId, deploymentId)).limit(1)

  if (existingFix.length > 0) {
    return NextResponse.json({ received: true, action: 'duplicate' })
  }

  // Create build_fixes record
  const fixId = nanoid()
  await db.insert(buildFixes).values({
    id: fixId,
    subscriptionId: subscription.id,
    deploymentId,
    deploymentUrl,
    status: 'pending',
  })

  // Dispatch Inngest event for async processing
  await inngest.send({
    name: 'build-failure/received',
    data: {
      fixId,
      subscriptionId: subscription.id,
      deploymentId,
      projectId,
    },
  })

  return NextResponse.json({ received: true, action: 'queued', fixId })
}
```

### Manual Fix Trigger (app/api/[integrations]/vercel/fix/route.ts)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { db } from '@/lib/db/client'
import { vercelSubscriptions, buildFixes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deploymentId, projectId, subscriptionId } = await req.json()

  // Verify ownership
  const subscription = await db
    .select()
    .from(vercelSubscriptions)
    .where(and(eq(vercelSubscriptions.id, subscriptionId), eq(vercelSubscriptions.userId, session.user.id)))
    .limit(1)

  if (!subscription.length) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  // Create fix record
  const fixId = nanoid()
  await db.insert(buildFixes).values({
    id: fixId,
    subscriptionId,
    deploymentId,
    status: 'queued',
  })

  // Dispatch Inngest event
  await inngest.send({
    name: 'build-failure/received',
    data: { fixId, subscriptionId, deploymentId, projectId },
  })

  return NextResponse.json({ success: true, fixId })
}
```

---

## Inngest Functions

### Main Orchestrator (lib/inngest/functions/build-fixes/handle-build-failure.ts)

```ts
import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { buildFixes, vercelSubscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBuildLogs, getDeployment } from '@/lib/integrations/vercel/client'
import { analyzeBuildLogs, type AnalysisResult } from '@/lib/integrations/vercel/build-fix/analyzer'
import { findMatchingRule } from '@/lib/integrations/vercel/build-fix/rules'
import { getVercelTokenByUserId } from '@/lib/integrations/vercel/user-token'

export default inngest.createFunction(
  { id: 'handle-build-failure' },
  { event: 'build-failure/received' },
  async ({ event, step }) => {
    const { fixId, subscriptionId, deploymentId, projectId } = event.data

    // Step 1: Update status to analyzing
    await step.run('update-status-analyzing', async () => {
      await db.update(buildFixes).set({ status: 'analyzing', startedAt: new Date() }).where(eq(buildFixes.id, fixId))
    })

    // Step 2: Fetch deployment details
    const deployment = await step.run('fetch-deployment', async () => {
      return getDeployment(deploymentId)
    })

    // Step 3: Fetch build logs
    const logs = await step.run('fetch-logs', async () => {
      return getBuildLogs(deploymentId)
    })

    // Step 4: Analyze logs
    const analysis = await step.run('analyze-logs', async () => {
      await db.update(buildFixes).set({ logs }).where(eq(buildFixes.id, fixId))
      return analyzeBuildLogs(logs)
    })

    // Step 5: Update with error info
    await step.run('update-error-info', async () => {
      await db
        .update(buildFixes)
        .set({
          errorType: analysis.errorType,
          errorMessage: analysis.errorMessage,
          errorContext: analysis.errorContext,
        })
        .where(eq(buildFixes.id, fixId))
    })

    // Step 6: Check rules
    const matchedRule = await step.run('check-rules', async () => {
      return findMatchingRule(subscriptionId, analysis)
    })

    if (matchedRule?.skipFix) {
      await db
        .update(buildFixes)
        .set({ status: 'skipped', matchedRuleId: matchedRule.id, completedAt: new Date() })
        .where(eq(buildFixes.id, fixId))
      return { status: 'skipped', reason: 'Rule matched: skip fix' }
    }

    // Step 7: Get subscription for repo info
    const subscription = await step.run('get-subscription', async () => {
      const subs = await db
        .select()
        .from(vercelSubscriptions)
        .where(eq(vercelSubscriptions.id, subscriptionId))
        .limit(1)
      return subs[0]
    })

    // Step 8: Create fix task in sandbox
    const fixPrompt = buildFixPrompt(analysis, deployment, matchedRule)

    // Dispatch to task executor (reuse existing task infrastructure)
    // This creates a Task with the fix prompt and runs OpenCode

    return { status: 'fixing', fixId }
  },
)

function buildFixPrompt(
  analysis: AnalysisResult,
  deployment: any,
  rule: { customPrompt?: string | null } | null,
): string {
  const basePrompt = `
You are tasked with fixing a build failure in a Next.js project.

## Error Details
- Type: ${analysis.errorType}
- Message: ${analysis.errorMessage}

## Error Context
\`\`\`
${analysis.errorContext}
\`\`\`

## Affected Files
${analysis.affectedFiles.map((f) => `- ${f}`).join('\n')}

## Instructions
1. Analyze the error and identify the root cause
2. Make minimal changes to fix the issue
3. Ensure the fix doesn't break other functionality
4. Add any necessary type annotations or null checks

${rule?.customPrompt ? `## Custom Instructions\n${rule.customPrompt}` : ''}
`
  return basePrompt
}
```

---

## UI Components

### Dashboard Stats (components/build-fixes/dashboard/build-fix-stats.tsx)

```tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'

interface BuildFixStatsProps {
  total: number
  fixed: number
  pending: number
  failed: number
}

export function BuildFixStats({ total, fixed, pending, failed }: BuildFixStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Fixes</p>
              <p className="text-2xl font-semibold">{total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fixed</p>
              <p className="text-2xl font-semibold">{fixed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-semibold">{failed}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Fix Status Badge (components/build-fixes/shared/fix-status-badge.tsx)

```tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Loader2, XCircle, SkipForward, GitPullRequest } from 'lucide-react'
import { cn } from '@/lib/utils'

type FixStatus =
  | 'pending'
  | 'queued'
  | 'analyzing'
  | 'fixing'
  | 'reviewing'
  | 'pr_created'
  | 'merged'
  | 'failed'
  | 'skipped'
  | 'cancelled'

interface FixStatusBadgeProps {
  status: FixStatus
  className?: string
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, variant: 'secondary' },
  queued: { label: 'Queued', icon: Clock, variant: 'secondary' },
  analyzing: { label: 'Analyzing', icon: Loader2, variant: 'default' },
  fixing: { label: 'Fixing', icon: Loader2, variant: 'default' },
  reviewing: { label: 'Reviewing', icon: Loader2, variant: 'default' },
  pr_created: { label: 'PR Created', icon: GitPullRequest, variant: 'success' },
  merged: { label: 'Merged', icon: CheckCircle2, variant: 'success' },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' },
  skipped: { label: 'Skipped', icon: SkipForward, variant: 'secondary' },
  cancelled: { label: 'Cancelled', icon: XCircle, variant: 'secondary' },
} as const

export function FixStatusBadge({ status, className }: FixStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending
  const Icon = config.icon

  return (
    <Badge variant={config.variant as any} className={cn('gap-1', className)}>
      <Icon className={cn('h-3 w-3', ['analyzing', 'fixing', 'reviewing'].includes(status) && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

- [ ] Create `lib/integrations/types.ts` with shared interfaces
- [ ] Create `lib/integrations/registry.ts` with provider registry
- [ ] Create `lib/integrations/connection-manager.ts` for DB operations
- [ ] Update `lib/db/schema.ts` with Vercel provider enum
- [ ] Generate migration with `pnpm drizzle-kit generate`
- [ ] Update `lib/session/types.ts` to include 'vercel' in authProvider

### Phase 2: Vercel OAuth (Days 2-3)

- [ ] Create `lib/integrations/vercel/index.ts` (OAuthProvider)
- [ ] Create `lib/integrations/vercel/client.ts` (API client)
- [ ] Create `lib/integrations/vercel/user-token.ts` (token resolution)
- [ ] Create OAuth routes: signin, callback, status, disconnect
- [ ] Add environment variables: `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`

### Phase 3: Database Schema (Day 3)

- [ ] Create `vercel_subscriptions` table
- [ ] Create `fix_rules` table
- [ ] Create `build_fixes` table
- [ ] Generate migration
- [ ] Run migration on development database

### Phase 4: Webhooks & Analysis (Days 4-5)

- [ ] Create webhook verification in `lib/integrations/vercel/webhooks.ts`
- [ ] Create `lib/integrations/vercel/build-fix/types.ts`
- [ ] Create `lib/integrations/vercel/build-fix/analyzer.ts`
- [ ] Create `lib/integrations/vercel/build-fix/rules.ts`
- [ ] Create webhook route handler
- [ ] Add `VERCEL_WEBHOOK_SECRET` environment variable

### Phase 5: Inngest Pipeline (Days 5-7)

- [ ] Create Inngest event types for build failures
- [ ] Create `handle-build-failure.ts` orchestrator
- [ ] Create `fetch-build-logs.ts` function
- [ ] Create `analyze-error.ts` function
- [ ] Create `run-fix.ts` function (integrates with sandbox)
- [ ] Create `create-fix-pr.ts` function

### Phase 6: API Routes (Days 7-8)

- [ ] Create projects list route
- [ ] Create subscriptions CRUD routes
- [ ] Create deployments list route
- [ ] Create fixes list/detail routes
- [ ] Create manual fix trigger route
- [ ] Create fix rules CRUD routes

### Phase 7: UI Dashboard (Days 8-10)

- [ ] Create build-fixes dashboard page
- [ ] Create build-fix-stats component
- [ ] Create active-issues-list component
- [ ] Create fix-card component
- [ ] Create fix-status-badge component
- [ ] Add "Build Fixes" to sidebar navigation

### Phase 8: Settings & Management (Days 10-12)

- [ ] Create Vercel settings page
- [ ] Create project-subscriptions component
- [ ] Create project-linker-dialog component
- [ ] Create fix-rules-editor component
- [ ] Create connect-button for Vercel
- [ ] Add Vercel card to main settings page

### Phase 9: Repo Integration (Days 12-13)

- [ ] Create deployments tab for repo pages
- [ ] Create deployment-row component
- [ ] Add auto-fix status to deployment rows
- [ ] Create manual-fix-button component

### Phase 10: Testing & Polish (Days 13-15)

- [ ] Test OAuth flow end-to-end
- [ ] Test webhook handling with Vercel test deployments
- [ ] Test fix pipeline with intentional build errors
- [ ] Run `pnpm type-check`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm format`
- [ ] Run `pnpm build`

---

## Checklist Before Merging

- [ ] Provider implements `OAuthProvider` interface
- [ ] Provider is registered in `registry.ts`
- [ ] DB schema updated with new tables + migration generated
- [ ] Session types updated with 'vercel' in authProvider
- [ ] OAuth routes created (signin, callback, status, disconnect)
- [ ] All tokens encrypted before storage (use `encrypt()` from `lib/crypto`)
- [ ] No dynamic values in log statements (static strings only)
- [ ] New env var secrets added to `lib/utils/logging.ts` redaction patterns
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes (0 errors)
- [ ] `pnpm format` applied
- [ ] `pnpm build` succeeds

---

## Environment Variables

```env
# Vercel Integration
VERCEL_CLIENT_ID=your_client_id
VERCEL_CLIENT_SECRET=your_client_secret
VERCEL_WEBHOOK_SECRET=your_webhook_secret
```

### Dependencies

```bash
pnpm add @vercel/sdk
```

Add to `.env.example` and update redaction patterns in `lib/utils/logging.ts`.

---

## Notes

- The fix pipeline reuses the existing sandbox and OpenCode infrastructure
- GitHub PR creation uses the existing `lib/github/client.ts` functions
- The dashboard follows the same pattern as Tasks and Reviews pages
- Manual fix triggers allow user control while auto-fix handles the common case
- Fix rules provide granular control per project and error pattern
