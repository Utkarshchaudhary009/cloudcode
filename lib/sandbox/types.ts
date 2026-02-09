import { Sandbox } from '@vercel/sandbox'
import { LogEntry } from '@/lib/db/schema'

export interface SandboxConfig {
  taskId: string
  repoUrl: string
  githubToken?: string | null
  gitAuthorName?: string
  gitAuthorEmail?: string
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
  }
  timeout?: string
  ports?: number[]
  runtime?: string
  resources?: {
    vcpus?: number
  }
  taskPrompt?: string
  selectedProvider?: string
  selectedModel?: string
  installDependencies?: boolean
  keepAlive?: boolean
  enableBrowser?: boolean
  preDeterminedBranchName?: string
  onProgress?: (progress: number, message: string) => Promise<void>
  onCancellationCheck?: () => Promise<boolean>
}

export interface SandboxResult {
  success: boolean
  sandbox?: Sandbox
  domain?: string
  branchName?: string
  error?: string
  cancelled?: boolean
}

export interface AgentExecutionResult {
  success: boolean
  output?: string
  agentResponse?: string
  cliName?: string
  changesDetected?: boolean
  error?: string
  streamingLogs?: unknown[]
  logs?: LogEntry[]
  opencodeSessionId?: string // For OpenCode session resumption
}
