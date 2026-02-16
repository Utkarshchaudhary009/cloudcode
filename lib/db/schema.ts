import 'server-only'

import { pgTable, text, timestamp, integer, jsonb, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'
import type {
  LogEntry,
  User,
  InsertUser,
  Task,
  InsertTask,
  Connector,
  InsertConnector,
  Account,
  InsertAccount,
  Key,
  InsertKey,
  TaskMessage,
  InsertTaskMessage,
  Setting,
  InsertSetting,
  ScheduledTask,
  InsertScheduledTask,
  Review,
  InsertReview,
  ReviewFinding,
  ReviewRule,
  InsertReviewRule,
  UserConnection,
  InsertUserConnection,
  Integration,
  InsertIntegration,
  Subscription,
  InsertSubscription,
  Deployment,
  InsertDeployment,
  FixRule,
  InsertFixRule,
} from './types'

export type {
  LogEntry,
  User,
  InsertUser,
  Task,
  InsertTask,
  Connector,
  InsertConnector,
  Account,
  InsertAccount,
  Key,
  InsertKey,
  TaskMessage,
  InsertTaskMessage,
  Setting,
  InsertSetting,
  ScheduledTask,
  InsertScheduledTask,
  Review,
  InsertReview,
  ReviewFinding,
  ReviewRule,
  InsertReviewRule,
  UserConnection,
  InsertUserConnection,
  Integration,
  InsertIntegration,
  Subscription,
  InsertSubscription,
  Deployment,
  InsertDeployment,
  FixRule,
  InsertFixRule,
}

export {
  logEntrySchema,
  insertUserSchema,
  selectUserSchema,
  insertTaskSchema,
  selectTaskSchema,
  insertConnectorSchema,
  selectConnectorSchema,
  insertAccountSchema,
  selectAccountSchema,
  insertKeySchema,
  selectKeySchema,
  insertTaskMessageSchema,
  selectTaskMessageSchema,
  insertSettingSchema,
  selectSettingSchema,
  insertScheduledTaskSchema,
  selectScheduledTaskSchema,
  insertReviewSchema,
  selectReviewSchema,
  insertReviewRuleSchema,
  selectReviewRuleSchema,
  insertIntegrationSchema,
  selectIntegrationSchema,
  insertSubscriptionSchema,
  selectSubscriptionSchema,
  insertDeploymentSchema,
  selectDeploymentSchema,
  insertFixRuleSchema,
  selectFixRuleSchema,
} from './types'

// Users table - user profile and primary OAuth account
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // Internal user ID (we generate this)
    // Primary OAuth account info (how they signed in)
    provider: text('provider', {
      enum: ['github'],
    }).notNull(), // Primary auth provider
    externalId: text('external_id').notNull(), // External ID from OAuth provider
    accessToken: text('access_token').notNull(), // Encrypted OAuth access token
    refreshToken: text('refresh_token'), // Encrypted OAuth refresh token
    scope: text('scope'), // OAuth scope
    // Profile info
    username: text('username').notNull(),
    email: text('email'),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: prevent duplicate signups from same provider + external ID
    providerExternalIdUnique: uniqueIndex('users_provider_external_id_idx').on(table.provider, table.externalId),
  }),
)

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users table
  prompt: text('prompt').notNull(),
  title: text('title'),
  repoUrl: text('repo_url'),
  selectedProvider: text('selected_provider').default('opencode'),
  selectedModel: text('selected_model'),
  installDependencies: boolean('install_dependencies').default(false),
  maxDuration: integer('max_duration').default(parseInt(process.env.MAX_SANDBOX_DURATION || '300', 10)),
  keepAlive: boolean('keep_alive').default(false),
  enableBrowser: boolean('enable_browser').default(false),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'error', 'stopped'],
  })
    .notNull()
    .default('pending'),
  progress: integer('progress').default(0),
  logs: jsonb('logs').$type<LogEntry[]>(),
  error: text('error'),
  branchName: text('branch_name'),
  sandboxId: text('sandbox_id'),
  opencodeSessionId: text('opencode_session_id'),
  sandboxUrl: text('sandbox_url'),
  previewUrl: text('preview_url'),
  prUrl: text('pr_url'),
  prNumber: integer('pr_number'),
  prStatus: text('pr_status', {
    enum: ['open', 'closed', 'merged'],
  }),
  prMergeCommitSha: text('pr_merge_commit_sha'),
  mcpServerIds: jsonb('mcp_server_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  deletedAt: timestamp('deleted_at'),
})

export const connectors = pgTable('connectors', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users table
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', {
    enum: ['local', 'remote'],
  })
    .notNull()
    .default('remote'),
  // For remote MCP servers
  baseUrl: text('base_url'),
  oauthClientId: text('oauth_client_id'),
  oauthClientSecret: text('oauth_client_secret'),
  // For local MCP servers
  command: text('command'),
  // Environment variables (for both local and remote) - stored encrypted
  env: text('env'),
  status: text('status', {
    enum: ['connected', 'disconnected'],
  })
    .notNull()
    .default('disconnected'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Accounts table - Additional accounts linked to users
// Currently GitHub and Vercel can be connected as additional accounts
// (e.g., Vercel users can connect their GitHub account)
// Multiple users can connect to the same external account (each as a separate record)
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users table
    provider: text('provider', {
      enum: ['github'],
    })
      .notNull()
      .default('github'),
    externalUserId: text('external_user_id').notNull(), // GitHub user ID or Vercel user ID
    accessToken: text('access_token').notNull(), // Encrypted OAuth access token
    refreshToken: text('refresh_token'), // Encrypted OAuth refresh token
    expiresAt: timestamp('expires_at'),
    scope: text('scope'),
    username: text('username').notNull(), // Provider username
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: a user can only have one account per provider
    userIdProviderUnique: uniqueIndex('accounts_user_id_provider_idx').on(table.userId, table.provider),
  }),
)

// Keys table - user's API keys for various services
// Each row represents one API key for one provider for one user
export const keys = pgTable(
  'keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users table
    provider: text('provider', {
      enum: [
        'anthropic',
        'openai',
        'cursor',
        'gemini',
        'aigateway',
        'groq',
        'openrouter',
        'vercel',
        'synthetic',
        'zai',
        'huggingface',
        'cerebras',
        'vertexai',
        'bedrock',
        'azure',
        'openai-compat',
        'anthropic-compat',
        'google',
        'google-vertex',
        'minimax',
        'opencode',
        'cohere',
        'deepseek',
        'moonshotai',
        'zhipuai',
      ],
    }).notNull(),
    value: text('value').notNull(), // Encrypted API key value
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: a user can only have one key per provider
    userIdProviderUnique: uniqueIndex('keys_user_id_provider_idx').on(table.userId, table.provider),
  }),
)

// Task messages table - stores user and agent messages for each task
export const taskMessages = pgTable('task_messages', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }), // Foreign key to tasks table
  role: text('role', {
    enum: ['user', 'agent'],
  }).notNull(), // Who sent the message
  content: text('content').notNull(), // The message content
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Settings table - key-value pairs for overriding environment variables per user
export const settings = pgTable(
  'settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // Required user reference
    key: text('key').notNull(), // Setting key (e.g., 'maxMessagesPerDay')
    value: text('value').notNull(), // Setting value (stored as text)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: prevent duplicate keys per user
    userIdKeyUnique: uniqueIndex('settings_user_id_key_idx').on(table.userId, table.key),
  }),
)

// Keep legacy export for backwards compatibility during migration
export const userConnections = accounts

// Scheduled tasks configuration
export const scheduledTasks = pgTable(
  'scheduled_tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    repoUrl: text('repo_url').notNull(),
    prompt: text('prompt').notNull(),
    taskType: text('task_type', {
      enum: ['bug_finder', 'ui_review', 'security_scan', 'code_quality', 'performance_audit', 'custom'],
    }).notNull(),
    timeSlot: text('time_slot', {
      enum: ['4am', '9am', '12pm', '9pm'],
    }).notNull(),
    days: jsonb('days')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => ['daily']),
    timezone: text('timezone').notNull().default('UTC'),
    selectedProvider: text('selected_provider').default('opencode'),
    selectedModel: text('selected_model'),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at'),
    lastRunStatus: text('last_run_status', {
      enum: ['success', 'error', 'running'],
    }),
    lastRunTaskId: text('last_run_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    timeSlotIdx: uniqueIndex('scheduled_tasks_user_time_slot_idx').on(table.userId, table.repoUrl, table.timeSlot),
  }),
)

// PR Reviews
export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    repoUrl: text('repo_url').notNull(),
    prNumber: integer('pr_number').notNull(),
    prTitle: text('pr_title'),
    prAuthor: text('pr_author'),
    headSha: text('head_sha').notNull(),
    baseBranch: text('base_branch'),
    headBranch: text('head_branch'),
    status: text('status', {
      enum: ['pending', 'in_progress', 'completed', 'error'],
    })
      .notNull()
      .default('pending'),
    summary: text('summary'),
    findings: jsonb('findings').$type<
      Array<{
        file: string
        line?: number
        severity: 'error' | 'warning' | 'info'
        message: string
        suggestion?: string
      }>
    >(),
    score: integer('score'),
    selectedProvider: text('selected_provider').default('opencode'),
    selectedModel: text('selected_model'),
    reviewRules: jsonb('review_rules'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    repoPrShaUnique: uniqueIndex('reviews_repo_pr_sha_idx').on(table.repoUrl, table.prNumber, table.headSha),
  }),
)

// Review rules (user-defined)
export const reviewRules = pgTable(
  'review_rules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    prompt: text('prompt').notNull(),
    severity: text('severity', {
      enum: ['error', 'warning', 'info'],
    })
      .notNull()
      .default('warning'),
    repoUrl: text('repo_url'),
    filePatterns: jsonb('file_patterns').$type<string[]>(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex('review_rules_user_name_idx').on(table.userId, table.name),
  }),
)

// Integrations table - API token connections for deployment platforms (Vercel, Cloudflare, Render, etc.)
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
    externalUserId: text('external_user_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    username: text('username').notNull(),
    teamId: text('team_id'),
    tokenCreatedAt: timestamp('token_created_at'),
    tokenNote: text('token_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('integrations_user_provider_idx').on(table.userId, table.provider),
  }),
)

// Subscriptions table - Links deployment platform projects to GitHub repos with fix settings
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
    platformProjectId: text('platform_project_id').notNull(),
    platformProjectName: text('platform_project_name').notNull(),
    webhookId: text('webhook_id'),
    webhookSecret: text('webhook_secret'),
    githubRepoFullName: text('github_repo_full_name').notNull(),
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

// Fix rules table - User-defined rules to customize or skip specific error patterns
export const fixRules = pgTable(
  'fix_rules',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    errorPattern: text('error_pattern').notNull(),
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

// Deployments table - Tracks only fix-related data for failed deployments
export const deployments = pgTable(
  'deployments',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    platformDeploymentId: text('platform_deployment_id').notNull(),
    webhookDeliveryId: text('webhook_delivery_id'),
    fixStatus: text('fix_status', {
      enum: ['pending', 'analyzing', 'fixing', 'reviewing', 'pr_created', 'merged', 'failed', 'skipped'],
    })
      .notNull()
      .default('pending'),
    fixAttemptNumber: integer('fix_attempt_number').default(1),
    version: integer('version').default(1).notNull(),
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
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    subscriptionIdx: index('deployments_subscription_idx').on(table.subscriptionId),
    platformDeploymentUnique: uniqueIndex('deployments_platform_deployment_idx').on(table.platformDeploymentId),
    webhookDeliveryUnique: uniqueIndex('deployments_webhook_delivery_idx').on(table.webhookDeliveryId),
    fixStatusIdx: index('deployments_fix_status_idx').on(table.fixStatus),
  }),
)
