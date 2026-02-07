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
    ANTHROPIC_API_KEY?: string
    GOOGLE_API_KEY?: string
    GOOGLE_VERTEX_PROJECT?: string
    GROQ_API_KEY?: string
    OPENROUTER_API_KEY?: string
    VERCEL_API_KEY?: string
    ZAI_API_KEY?: string
    HF_TOKEN?: string
    CEREBRAS_API_KEY?: string
    AZURE_OPENAI_API_KEY?: string
    MINIMAX_API_KEY?: string
    OPENCODE_API_KEY?: string
    COHERE_API_KEY?: string
    DEEPSEEK_API_KEY?: string
    MOONSHOT_API_KEY?: string
    ZHIPU_API_KEY?: string
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
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    VERCEL_API_KEY: process.env.VERCEL_API_KEY,
    ZAI_API_KEY: process.env.ZAI_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
    COHERE_API_KEY: process.env.COHERE_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,

    // Legacy/Fallbacks that might be read by opencode.ts
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    VERTEXAI_PROJECT: process.env.VERTEXAI_PROJECT,
    ZEN_API_KEY: process.env.ZEN_API_KEY,
  }

  // Set new keys
  if (apiKeys?.OPENAI_API_KEY) process.env.OPENAI_API_KEY = apiKeys.OPENAI_API_KEY
  if (apiKeys?.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = apiKeys.ANTHROPIC_API_KEY
  if (apiKeys?.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = apiKeys.GOOGLE_API_KEY
    process.env.GEMINI_API_KEY = apiKeys.GOOGLE_API_KEY // Back-compat for internal tools
  }
  if (apiKeys?.GOOGLE_VERTEX_PROJECT) {
    process.env.GOOGLE_VERTEX_PROJECT = apiKeys.GOOGLE_VERTEX_PROJECT
    process.env.VERTEXAI_PROJECT = apiKeys.GOOGLE_VERTEX_PROJECT // Back-compat
  }
  if (apiKeys?.GROQ_API_KEY) process.env.GROQ_API_KEY = apiKeys.GROQ_API_KEY
  if (apiKeys?.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = apiKeys.OPENROUTER_API_KEY
  if (apiKeys?.VERCEL_API_KEY) process.env.VERCEL_API_KEY = apiKeys.VERCEL_API_KEY
  if (apiKeys?.ZAI_API_KEY) process.env.ZAI_API_KEY = apiKeys.ZAI_API_KEY
  if (apiKeys?.HF_TOKEN) process.env.HF_TOKEN = apiKeys.HF_TOKEN
  if (apiKeys?.CEREBRAS_API_KEY) process.env.CEREBRAS_API_KEY = apiKeys.CEREBRAS_API_KEY
  if (apiKeys?.AZURE_OPENAI_API_KEY) process.env.AZURE_OPENAI_API_KEY = apiKeys.AZURE_OPENAI_API_KEY
  if (apiKeys?.MINIMAX_API_KEY) process.env.MINIMAX_API_KEY = apiKeys.MINIMAX_API_KEY
  if (apiKeys?.OPENCODE_API_KEY) {
    process.env.OPENCODE_API_KEY = apiKeys.OPENCODE_API_KEY
    process.env.ZEN_API_KEY = apiKeys.OPENCODE_API_KEY // Back-compat
  }
  if (apiKeys?.COHERE_API_KEY) process.env.COHERE_API_KEY = apiKeys.COHERE_API_KEY
  if (apiKeys?.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = apiKeys.DEEPSEEK_API_KEY
  if (apiKeys?.MOONSHOT_API_KEY) process.env.MOONSHOT_API_KEY = apiKeys.MOONSHOT_API_KEY
  if (apiKeys?.ZHIPU_API_KEY) process.env.ZHIPU_API_KEY = apiKeys.ZHIPU_API_KEY

  try {
    return await executeOpenCodeInSandbox(sandbox, instruction, logger, selectedModel, mcpServers, isResumed, sessionId)
  } finally {
    // Restore original environment variables
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY
    process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY
    process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY
    process.env.GOOGLE_VERTEX_PROJECT = originalEnv.GOOGLE_VERTEX_PROJECT
    process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY
    process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY
    process.env.VERCEL_API_KEY = originalEnv.VERCEL_API_KEY
    process.env.ZAI_API_KEY = originalEnv.ZAI_API_KEY
    process.env.HF_TOKEN = originalEnv.HF_TOKEN
    process.env.CEREBRAS_API_KEY = originalEnv.CEREBRAS_API_KEY
    process.env.AZURE_OPENAI_API_KEY = originalEnv.AZURE_OPENAI_API_KEY
    process.env.MINIMAX_API_KEY = originalEnv.MINIMAX_API_KEY
    process.env.OPENCODE_API_KEY = originalEnv.OPENCODE_API_KEY
    process.env.COHERE_API_KEY = originalEnv.COHERE_API_KEY
    process.env.DEEPSEEK_API_KEY = originalEnv.DEEPSEEK_API_KEY
    process.env.MOONSHOT_API_KEY = originalEnv.MOONSHOT_API_KEY
    process.env.ZHIPU_API_KEY = originalEnv.ZHIPU_API_KEY
    process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY
    process.env.VERTEXAI_PROJECT = originalEnv.VERTEXAI_PROJECT
    process.env.ZEN_API_KEY = originalEnv.ZEN_API_KEY
  }
}
