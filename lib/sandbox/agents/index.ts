import { Sandbox } from '@vercel/sandbox'
import { AgentExecutionResult } from '../types'
import { executeOpenCodeInSandbox } from './opencode'
import { TaskLogger } from '@/lib/utils/task-logger'
import { Connector } from '@/lib/db/schema'

// Re-export types
export type { AgentExecutionResult } from '../types'

export type ApiKeys = {
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
  GH_TOKEN?: string
  GITHUB_TOKEN?: string
}

// Main agent execution function
export async function executeAgentInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  onCancellationCheck?: () => Promise<boolean>,
  apiKeys?: ApiKeys,
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
      cliName: 'opencode',
      changesDetected: false,
    }
  }

  try {
    // Default to opencode
    return await executeOpenCodeInSandbox(
      sandbox,
      instruction,
      logger,
      selectedModel,
      mcpServers,
      isResumed,
      sessionId,
      apiKeys,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during agent execution'
    await logger.error('Agent execution failed')
    console.error('Agent execution failed:', errorMessage)
    return {
      success: false,
      error: errorMessage,
      cliName: 'opencode',
      changesDetected: false,
    }
  }
}
