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
  },
) {
  const errors: string[] = []

  const hasOpenAI = apiKeys?.OPENAI_API_KEY || process.env.OPENAI_API_KEY
  const hasAnthropic = apiKeys?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  const hasGemini = apiKeys?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
  const hasGroq = apiKeys?.GROQ_API_KEY || process.env.GROQ_API_KEY
  const hasOpenRouter = apiKeys?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY

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
    default:
      if (!hasOpenAI && !hasAnthropic && !hasGemini && !hasGroq && !hasOpenRouter) {
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
