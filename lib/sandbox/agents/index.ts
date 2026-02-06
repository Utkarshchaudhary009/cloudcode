import { Sandbox } from '@vercel/sandbox'
import { AgentExecutionResult } from '../types'
import { executeOpenCodeInSandbox } from './opencode'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

export type AgentType = 'opencode'

// Re-export types
export type { AgentExecutionResult } from '../types'

// Main agent execution function
export async function executeAgentInSandbox(
  sandbox: Sandbox,
  instruction: string,
  agentType: AgentType,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  onCancellationCheck?: () => Promise<boolean>,
  apiKeys?: {
    OPENAI_API_KEY?: string
    GEMINI_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    AI_GATEWAY_API_KEY?: string
    GROQ_API_KEY?: string
    OPENROUTER_API_KEY?: string
    VERCEL_API_KEY?: string
    SYNTHETIC_API_KEY?: string
    ZAI_API_KEY?: string
    HF_TOKEN?: string
    CEREBRAS_API_KEY?: string
    VERTEXAI_PROJECT?: string
    AWS_ACCESS_KEY_ID?: string
    AZURE_OPENAI_API_KEY?: string
  },
  isResumed?: boolean,
  sessionId?: string,
  taskId?: string,
  agentMessageId?: string,
): Promise<AgentExecutionResult> {
  // Check for cancellation before starting agent execution
  if (onCancellationCheck && (await onCancellationCheck())) {
    await logger.info('Task was cancelled before agent execution')
    return {
      success: false,
      error: 'Task was cancelled',
      cliName: agentType,
      changesDetected: false,
    }
  }

  // Temporarily override process.env with user's API keys if provided
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    VERCEL_API_KEY: process.env.VERCEL_API_KEY,
    SYNTHETIC_API_KEY: process.env.SYNTHETIC_API_KEY,
    ZAI_API_KEY: process.env.ZAI_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    VERTEXAI_PROJECT: process.env.VERTEXAI_PROJECT,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  }

  if (apiKeys?.OPENAI_API_KEY) process.env.OPENAI_API_KEY = apiKeys.OPENAI_API_KEY
  if (apiKeys?.GEMINI_API_KEY) process.env.GEMINI_API_KEY = apiKeys.GEMINI_API_KEY
  if (apiKeys?.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = apiKeys.ANTHROPIC_API_KEY
  if (apiKeys?.AI_GATEWAY_API_KEY) process.env.AI_GATEWAY_API_KEY = apiKeys.AI_GATEWAY_API_KEY
  if (apiKeys?.GROQ_API_KEY) process.env.GROQ_API_KEY = apiKeys.GROQ_API_KEY
  if (apiKeys?.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = apiKeys.OPENROUTER_API_KEY
  if (apiKeys?.VERCEL_API_KEY) process.env.VERCEL_API_KEY = apiKeys.VERCEL_API_KEY
  if (apiKeys?.SYNTHETIC_API_KEY) process.env.SYNTHETIC_API_KEY = apiKeys.SYNTHETIC_API_KEY
  if (apiKeys?.ZAI_API_KEY) process.env.ZAI_API_KEY = apiKeys.ZAI_API_KEY
  if (apiKeys?.HF_TOKEN) process.env.HF_TOKEN = apiKeys.HF_TOKEN
  if (apiKeys?.CEREBRAS_API_KEY) process.env.CEREBRAS_API_KEY = apiKeys.CEREBRAS_API_KEY
  if (apiKeys?.VERTEXAI_PROJECT) process.env.VERTEXAI_PROJECT = apiKeys.VERTEXAI_PROJECT
  if (apiKeys?.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = apiKeys.AWS_ACCESS_KEY_ID
  if (apiKeys?.AZURE_OPENAI_API_KEY) process.env.AZURE_OPENAI_API_KEY = apiKeys.AZURE_OPENAI_API_KEY

  try {
    return await executeOpenCodeInSandbox(sandbox, instruction, logger, selectedModel, mcpServers, isResumed, sessionId)
  } finally {
    // Restore original environment variables
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY
    process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY
    process.env.AI_GATEWAY_API_KEY = originalEnv.AI_GATEWAY_API_KEY
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY
    process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY
    process.env.VERCEL_API_KEY = originalEnv.VERCEL_API_KEY
    process.env.SYNTHETIC_API_KEY = originalEnv.SYNTHETIC_API_KEY
    process.env.ZAI_API_KEY = originalEnv.ZAI_API_KEY
    process.env.HF_TOKEN = originalEnv.HF_TOKEN
    process.env.CEREBRAS_API_KEY = originalEnv.CEREBRAS_API_KEY
    process.env.VERTEXAI_PROJECT = originalEnv.VERTEXAI_PROJECT
    process.env.AWS_ACCESS_KEY_ID = originalEnv.AWS_ACCESS_KEY_ID
    process.env.AZURE_OPENAI_API_KEY = originalEnv.AZURE_OPENAI_API_KEY
  }
}
