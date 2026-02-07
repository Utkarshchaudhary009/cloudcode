export type OpenCodeProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'vercel'
  | 'synthetic'
  | 'zai'
  | 'huggingface'
  | 'cerebras'
  | 'vertexai'
  | 'bedrock'
  | 'azure'
  | 'openai-compat'
  | 'anthropic-compat'
  | 'zen'

export const SUPPORTED_OPENCODE_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
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
  'zen',
] as const satisfies ReadonlyArray<OpenCodeProviderId>

export const DEFAULT_OPENCODE_PROVIDER: OpenCodeProviderId = 'openai'

export const OPENCODE_PROVIDER_LABELS: Record<OpenCodeProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  vercel: 'Vercel AI Gateway',
  synthetic: 'Synthetic',
  zai: 'Z.ai',
  huggingface: 'Hugging Face',
  cerebras: 'Cerebras',
  vertexai: 'Vertex AI',
  bedrock: 'Amazon Bedrock',
  azure: 'Azure OpenAI',
  'openai-compat': 'OpenAI Compatible',
  'anthropic-compat': 'Anthropic Compatible',
  zen: 'Zen',
}

export const isOpenCodeProvider = (value: string | null | undefined): value is OpenCodeProviderId => {
  if (!value) return false
  return SUPPORTED_OPENCODE_PROVIDERS.includes(value as OpenCodeProviderId)
}

export const normalizeOpenCodeProvider = (value: string | null | undefined): OpenCodeProviderId => {
  if (isOpenCodeProvider(value)) {
    return value
  }
  return DEFAULT_OPENCODE_PROVIDER
}
