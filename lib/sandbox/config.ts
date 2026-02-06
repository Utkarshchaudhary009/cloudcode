export function validateEnvironmentVariables(
  selectedAgent: string = 'openai',
  githubToken?: string | null,
  apiKeys?: {
    OPENAI_API_KEY?: string
    GEMINI_API_KEY?: string
    CURSOR_API_KEY?: string
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
) {
  const errors: string[] = []

  const hasOpenAI = apiKeys?.OPENAI_API_KEY || process.env.OPENAI_API_KEY
  const hasAnthropic = apiKeys?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  const hasGemini = apiKeys?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
  const hasGroq = apiKeys?.GROQ_API_KEY || process.env.GROQ_API_KEY
  const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
  const hasVercel = apiKeys?.VERCEL_API_KEY || process.env.VERCEL_API_KEY || apiKeys?.AI_GATEWAY_API_KEY
  const hasSynthetic = apiKeys?.SYNTHETIC_API_KEY || process.env.SYNTHETIC_API_KEY
  const hasZai = apiKeys?.ZAI_API_KEY || process.env.ZAI_API_KEY
  const hasHuggingFace = apiKeys?.HF_TOKEN || process.env.HF_TOKEN
  const hasCerebras = apiKeys?.CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY
  const hasVertex = apiKeys?.VERTEXAI_PROJECT || process.env.VERTEXAI_PROJECT
  const hasBedrock = apiKeys?.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const hasAzure = apiKeys?.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY

  switch (selectedAgent) {
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
    case 'gemini':
      if (!hasGemini) {
        errors.push('GEMINI_API_KEY is required for OpenCode with Gemini.')
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
    case 'synthetic':
      if (!hasSynthetic) {
        errors.push('SYNTHETIC_API_KEY is required for OpenCode with Synthetic.')
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
    case 'vertexai':
      if (!hasVertex) {
        errors.push('VERTEXAI_PROJECT is required for OpenCode with Vertex AI.')
      }
      break
    case 'bedrock':
      if (!hasBedrock) {
        errors.push('AWS_ACCESS_KEY_ID is required for OpenCode with Amazon Bedrock.')
      }
      break
    case 'azure':
      if (!hasAzure) {
        errors.push('AZURE_OPENAI_API_KEY is required for OpenCode with Azure OpenAI.')
      }
      break
    case 'openai-compat':
      if (!hasOpenAI) {
        errors.push('OPENAI_API_KEY is required for OpenCode with OpenAI Compatible.')
      }
      break
    case 'anthropic-compat':
      if (!hasAnthropic) {
        errors.push('ANTHROPIC_API_KEY is required for OpenCode with Anthropic Compatible.')
      }
      break
    default:
      if (
        !hasOpenAI &&
        !hasAnthropic &&
        !hasGemini &&
        !hasGroq &&
        !hasOpenRouter &&
        !hasVercel &&
        !hasSynthetic &&
        !hasZai &&
        !hasHuggingFace &&
        !hasCerebras &&
        !hasVertex &&
        !hasBedrock &&
        !hasAzure
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
