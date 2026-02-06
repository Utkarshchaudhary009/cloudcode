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
  }

  if (apiKeys?.OPENAI_API_KEY) process.env.OPENAI_API_KEY = apiKeys.OPENAI_API_KEY
  if (apiKeys?.GEMINI_API_KEY) process.env.GEMINI_API_KEY = apiKeys.GEMINI_API_KEY
  if (apiKeys?.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = apiKeys.ANTHROPIC_API_KEY
  if (apiKeys?.AI_GATEWAY_API_KEY) process.env.AI_GATEWAY_API_KEY = apiKeys.AI_GATEWAY_API_KEY
  if (apiKeys?.GROQ_API_KEY) process.env.GROQ_API_KEY = apiKeys.GROQ_API_KEY
  if (apiKeys?.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = apiKeys.OPENROUTER_API_KEY

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
  }
}
