export function validateEnvironmentVariables(
  selectedProvider: string = 'opencode',
  githubToken?: string | null,
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
    // Legacy support
    GEMINI_API_KEY?: string
    VERTEXAI_PROJECT?: string
    ZEN_API_KEY?: string
  },
) {
  const errors: string[] = []

  const hasOpenAI = apiKeys?.OPENAI_API_KEY || process.env.OPENAI_API_KEY
  const hasAnthropic = apiKeys?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  const hasGoogle =
    apiKeys?.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || apiKeys?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
  const hasVertex =
    apiKeys?.GOOGLE_VERTEX_PROJECT ||
    process.env.GOOGLE_VERTEX_PROJECT ||
    apiKeys?.VERTEXAI_PROJECT ||
    process.env.VERTEXAI_PROJECT
  const hasGroq = apiKeys?.GROQ_API_KEY || process.env.GROQ_API_KEY
  const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
  const hasVercel = apiKeys?.VERCEL_API_KEY || process.env.VERCEL_API_KEY
  const hasZai = apiKeys?.ZAI_API_KEY || process.env.ZAI_API_KEY
  const hasHuggingFace = apiKeys?.HF_TOKEN || process.env.HF_TOKEN
  const hasCerebras = apiKeys?.CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY
  const hasAzure = apiKeys?.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
  const hasMinimax = apiKeys?.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY
  const hasOpenCode =
    apiKeys?.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY || apiKeys?.ZEN_API_KEY || process.env.ZEN_API_KEY
  const hasCohere = apiKeys?.COHERE_API_KEY || process.env.COHERE_API_KEY
  const hasDeepSeek = apiKeys?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
  const hasMoonshot = apiKeys?.MOONSHOT_API_KEY || process.env.MOONSHOT_API_KEY
  const hasZhipu = apiKeys?.ZHIPU_API_KEY || process.env.ZHIPU_API_KEY

  switch (selectedProvider) {
    case 'openai':
      if (!hasOpenAI) {
        errors.push('OPENAI_API_KEY is required for OpenCode with OpenAI.')
      }
      break
    case 'anthropic':
      if (!hasAnthropic) {
        errors.push('ANTHROPIC_API_KEY is required for OpenCode with Anthropic.')
      }
      break
    case 'google':
    case 'gemini':
      if (!hasGoogle) {
        errors.push('GOOGLE_API_KEY is required for OpenCode with Google/Gemini.')
      }
      break
    case 'google-vertex':
    case 'vertexai':
      if (!hasVertex) {
        errors.push('GOOGLE_VERTEX_PROJECT is required for OpenCode with Google Vertex.')
      }
      break
    case 'groq':
      if (!hasGroq) {
        errors.push('GROQ_API_KEY is required for OpenCode with Groq.')
      }
      break
    case 'openrouter':
      if (!hasOpenRouter) {
        errors.push('OPENROUTER_API_KEY is required for OpenCode with OpenRouter.')
      }
      break
    case 'vercel':
      if (!hasVercel) {
        errors.push('VERCEL_API_KEY is required for OpenCode with Vercel AI Gateway.')
      }
      break
    case 'zai':
      if (!hasZai) {
        errors.push('ZAI_API_KEY is required for OpenCode with Z.ai.')
      }
      break
    case 'huggingface':
      if (!hasHuggingFace) {
        errors.push('HF_TOKEN is required for OpenCode with Hugging Face.')
      }
      break
    case 'cerebras':
      if (!hasCerebras) {
        errors.push('CEREBRAS_API_KEY is required for OpenCode with Cerebras.')
      }
      break
    case 'azure':
      if (!hasAzure) {
        errors.push('AZURE_OPENAI_API_KEY is required for OpenCode with Azure OpenAI.')
      }
      break
    case 'minimax':
      if (!hasMinimax) {
        errors.push('MINIMAX_API_KEY is required for OpenCode with MiniMax.')
      }
      break
    case 'opencode':
    case 'zen':
      if (!hasOpenCode) {
        errors.push('OPENCODE_API_KEY is required for OpenCode Zen.')
      }
      break
    case 'cohere':
      if (!hasCohere) {
        errors.push('COHERE_API_KEY is required for OpenCode with Cohere.')
      }
      break
    case 'deepseek':
      if (!hasDeepSeek) {
        errors.push('DEEPSEEK_API_KEY is required for OpenCode with DeepSeek.')
      }
      break
    case 'moonshotai':
      if (!hasMoonshot) {
        errors.push('MOONSHOT_API_KEY is required for OpenCode with Moonshot AI.')
      }
      break
    case 'zhipuai':
      if (!hasZhipu) {
        errors.push('ZHIPU_API_KEY is required for OpenCode with Zhipu AI.')
      }
      break
    default:
      if (
        !hasOpenAI &&
        !hasAnthropic &&
        !hasGoogle &&
        !hasVertex &&
        !hasGroq &&
        !hasOpenRouter &&
        !hasVercel &&
        !hasZai &&
        !hasHuggingFace &&
        !hasCerebras &&
        !hasAzure &&
        !hasMinimax &&
        !hasOpenCode &&
        !hasCohere &&
        !hasDeepSeek &&
        !hasMoonshot &&
        !hasZhipu
      ) {
        errors.push('A provider API key is required for OpenCode.')
      }
      break
  }

  // Check for GitHub token for private repositories
  // Use user's token if provided
  if (!githubToken) {
    errors.push('GitHub is required for repository access. Please connect your GitHub account.')
  }

  // Check for Vercel sandbox environment variables
  if (!process.env.SANDBOX_VERCEL_TEAM_ID) {
    errors.push('SANDBOX_VERCEL_TEAM_ID is required for sandbox creation')
  }

  if (!process.env.SANDBOX_VERCEL_PROJECT_ID) {
    errors.push('SANDBOX_VERCEL_PROJECT_ID is required for sandbox creation')
  }

  if (!process.env.SANDBOX_VERCEL_TOKEN) {
    errors.push('SANDBOX_VERCEL_TOKEN is required for sandbox creation')
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join(', ') : undefined,
  }
}

export function createAuthenticatedRepoUrl(repoUrl: string, githubToken?: string | null): string {
  if (!githubToken) {
    return repoUrl
  }

  try {
    const url = new URL(repoUrl)
    if (url.hostname === 'github.com') {
      // Add GitHub token for authentication
      url.username = githubToken
      url.password = 'x-oauth-basic'
    }
    return url.toString()
  } catch {
    // Failed to parse repository URL
    return repoUrl
  }
}

export function createSandboxConfiguration(config: {
  repoUrl: string
  timeout?: string
  ports?: number[]
  runtime?: string
  resources?: { vcpus?: number }
  branchName?: string
}) {
  return {
    template: 'node',
    git: {
      url: config.repoUrl,
      branch: config.branchName || 'main',
    },
    timeout: config.timeout || '20m',
    ports: config.ports || [3000],
    runtime: config.runtime || 'node22',
    resources: config.resources || { vcpus: 4 },
  }
}
