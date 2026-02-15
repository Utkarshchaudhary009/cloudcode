import { z } from 'zod'
import { openCodeProviderSchema } from '@/lib/opencode/provider-schema'

// Log entry types
export const logEntrySchema = z.object({
  type: z.enum(['info', 'command', 'error', 'success']),
  message: z.string(),
  timestamp: z.date().optional(),
})

export type LogEntry = z.infer<typeof logEntrySchema>

export const insertUserSchema = z.object({
  id: z.string().optional(), // Auto-generated if not provided
  provider: z.enum(['github']),
  externalId: z.string().min(1, 'External ID is required'),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
  username: z.string().min(1, 'Username is required'),
  email: z.string().email().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastLoginAt: z.date().optional(),
})

export const selectUserSchema = z.object({
  id: z.string(),
  provider: z.enum(['github']),
  externalId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  scope: z.string().nullable(),
  username: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date(),
})

export type User = z.infer<typeof selectUserSchema>
export type InsertUser = z.infer<typeof insertUserSchema>

// Manual Zod schemas for validation
export const insertTaskSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  title: z.string().optional(),
  repoUrl: z.string().url('Must be a valid URL').optional(),
  selectedProvider: openCodeProviderSchema,
  selectedModel: z.string().optional(),
  installDependencies: z.boolean().default(false),
  maxDuration: z.number().default(300), // Defaulting to 300 to avoid process.env in shared file if possible, or we can use it if we are sure it's available in both
  keepAlive: z.boolean().default(false),
  enableBrowser: z.boolean().default(false),
  status: z.enum(['pending', 'processing', 'completed', 'error', 'stopped']).default('pending'),
  progress: z.number().min(0).max(100).default(0),
  logs: z.array(logEntrySchema).optional(),
  error: z.string().optional(),
  branchName: z.string().optional(),
  sandboxId: z.string().optional(),
  opencodeSessionId: z.string().optional(),
  sandboxUrl: z.string().optional(),
  previewUrl: z.string().optional(),
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
  prStatus: z.enum(['open', 'closed', 'merged']).optional(),
  prMergeCommitSha: z.string().optional(),
  mcpServerIds: z.array(z.string()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  completedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

export const selectTaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  prompt: z.string(),
  title: z.string().nullable(),
  repoUrl: z.string().nullable(),
  selectedProvider: z.string().nullable(),
  selectedModel: z.string().nullable(),
  installDependencies: z.boolean().nullable(),
  maxDuration: z.number().nullable(),
  keepAlive: z.boolean().nullable(),
  enableBrowser: z.boolean().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'error', 'stopped']),
  progress: z.number().nullable(),
  logs: z.array(logEntrySchema).nullable(),
  error: z.string().nullable(),
  branchName: z.string().nullable(),
  sandboxId: z.string().nullable(),
  opencodeSessionId: z.string().nullable(),
  sandboxUrl: z.string().nullable(),
  previewUrl: z.string().nullable(),
  prUrl: z.string().nullable(),
  prNumber: z.number().nullable(),
  prStatus: z.enum(['open', 'closed', 'merged']).nullable(),
  prMergeCommitSha: z.string().nullable(),
  mcpServerIds: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
})

export type Task = z.infer<typeof selectTaskSchema>
export type InsertTask = z.infer<typeof insertTaskSchema>

export const insertConnectorSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['local', 'remote']).default('remote'),
  // For remote MCP servers
  baseUrl: z.string().url('Must be a valid URL').optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  // For local MCP servers
  command: z.string().optional(),
  // Environment variables (for both local and remote) - will be encrypted
  env: z.record(z.string(), z.string()).optional(),
  status: z.enum(['connected', 'disconnected']).default('disconnected'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectConnectorSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(['local', 'remote']),
  // For remote MCP servers
  baseUrl: z.string().nullable(),
  oauthClientId: z.string().nullable(),
  oauthClientSecret: z.string().nullable(),
  // For local MCP servers
  command: z.string().nullable(),
  // Environment variables (for both local and remote) - stored encrypted as string
  env: z.string().nullable(),
  status: z.enum(['connected', 'disconnected']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Connector = z.infer<typeof selectConnectorSchema>
export type InsertConnector = z.infer<typeof insertConnectorSchema>

export const insertAccountSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  provider: z.enum(['github']).default('github'),
  externalUserId: z.string().min(1, 'External user ID is required'),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  scope: z.string().optional(),
  username: z.string().min(1, 'Username is required'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.enum(['github']),
  externalUserId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.date().nullable(),
  scope: z.string().nullable(),
  username: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Account = z.infer<typeof selectAccountSchema>
export type InsertAccount = z.infer<typeof insertAccountSchema>

export const insertKeySchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  provider: z.enum([
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
  ]),
  value: z.string().min(1, 'API key value is required'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectKeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.enum([
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
  ]),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Key = z.infer<typeof selectKeySchema>
export type InsertKey = z.infer<typeof insertKeySchema>

export const insertTaskMessageSchema = z.object({
  id: z.string().optional(),
  taskId: z.string().min(1, 'Task ID is required'),
  role: z.enum(['user', 'agent']),
  content: z.string().min(1, 'Content is required'),
  createdAt: z.date().optional(),
})

export const selectTaskMessageSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  role: z.enum(['user', 'agent']),
  content: z.string(),
  createdAt: z.date(),
})

export type TaskMessage = z.infer<typeof selectTaskMessageSchema>
export type InsertTaskMessage = z.infer<typeof insertTaskMessageSchema>

export const insertSettingSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectSettingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  key: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Setting = z.infer<typeof selectSettingSchema>
export type InsertSetting = z.infer<typeof insertSettingSchema>

export const insertScheduledTaskSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Name is required'),
  repoUrl: z.string().url('Must be a valid URL'),
  prompt: z.string().min(1, 'Prompt is required'),
  taskType: z
    .enum(['bug_finder', 'ui_review', 'security_scan', 'code_quality', 'performance_audit', 'custom'])
    .default('custom'),
  timeSlot: z.enum(['4am', '9am', '12pm', '9pm']),
  days: z.array(z.string()).default(['daily']),
  timezone: z.string().default('UTC'),
  selectedProvider: openCodeProviderSchema,
  selectedModel: z.string().optional(),
  enabled: z.boolean().default(true),
  lastRunAt: z.date().optional(),
  lastRunStatus: z.enum(['success', 'error', 'running']).optional(),
  lastRunTaskId: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectScheduledTaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  repoUrl: z.string(),
  prompt: z.string(),
  taskType: z.enum(['bug_finder', 'ui_review', 'security_scan', 'code_quality', 'performance_audit', 'custom']),
  timeSlot: z.enum(['4am', '9am', '12pm', '9pm']),
  days: z.array(z.string()),
  timezone: z.string(),
  selectedProvider: z.string().nullable(),
  selectedModel: z.string().nullable(),
  enabled: z.boolean(),
  lastRunAt: z.date().nullable(),
  lastRunStatus: z.enum(['success', 'error', 'running']).nullable(),
  lastRunTaskId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ScheduledTask = z.infer<typeof selectScheduledTaskSchema>
export type InsertScheduledTask = z.infer<typeof insertScheduledTaskSchema>

export const insertReviewSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  taskId: z.string().optional(),
  repoUrl: z.string().url('Must be a valid URL'),
  prNumber: z.number().int().positive(),
  prTitle: z.string().optional(),
  prAuthor: z.string().optional(),
  headSha: z.string().min(1, 'Head SHA is required'),
  baseBranch: z.string().optional(),
  headBranch: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'error']).default('pending'),
  summary: z.string().optional(),
  findings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().int().positive().optional(),
        severity: z.enum(['error', 'warning', 'info']),
        message: z.string(),
        suggestion: z.string().optional(),
      }),
    )
    .optional(),
  score: z.number().int().min(0).max(100).optional(),
  selectedProvider: z.string().default('opencode'),
  selectedModel: z.string().optional(),
  reviewRules: z.any().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectReviewSchema = z.object({
  id: z.string(),
  userId: z.string(),
  taskId: z.string().nullable(),
  repoUrl: z.string(),
  prNumber: z.number().int(),
  prTitle: z.string().nullable(),
  prAuthor: z.string().nullable(),
  headSha: z.string(),
  baseBranch: z.string().nullable(),
  headBranch: z.string().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'error']),
  summary: z.string().nullable(),
  findings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().int().positive().optional(),
        severity: z.enum(['error', 'warning', 'info']),
        message: z.string(),
        suggestion: z.string().optional(),
      }),
    )
    .nullable(),
  score: z.number().int().nullable(),
  selectedProvider: z.string().nullable(),
  selectedModel: z.string().nullable(),
  reviewRules: z.any().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  error: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Review = z.infer<typeof selectReviewSchema>
export type InsertReview = z.infer<typeof insertReviewSchema>
export type ReviewFinding = NonNullable<z.infer<typeof selectReviewSchema>['findings']>[number]

export const insertReviewRuleSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  severity: z.enum(['error', 'warning', 'info']).default('warning'),
  repoUrl: z.string().url('Must be a valid URL').optional().or(z.literal(null)),
  filePatterns: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export const selectReviewRuleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  prompt: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  repoUrl: z.string().nullable(),
  filePatterns: z.array(z.string()).nullable(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ReviewRule = z.infer<typeof selectReviewRuleSchema>
export type InsertReviewRule = z.infer<typeof insertReviewRuleSchema>

// Keep legacy export for backwards compatibility during migration
export type UserConnection = Account
export type InsertUserConnection = InsertAccount
