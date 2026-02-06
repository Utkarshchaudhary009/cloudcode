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

export const OPENCODE_PROVIDERS = [] as const satisfies Array<{ value: OpenCodeProviderId; label: string }>

export const OPENCODE_PROVIDER_MODELS: Record<OpenCodeProviderId, Array<{ value: string; label: string }>> = {
  openai: [],
  anthropic: [],
  gemini: [],
  groq: [],
  openrouter: [],
  vercel: [],
  synthetic: [],
  zai: [],
  huggingface: [],
  cerebras: [],
  vertexai: [],
  bedrock: [],
  azure: [],
  'openai-compat': [],
  'anthropic-compat': [],
  zen: [],
}

export const DEFAULT_OPENCODE_PROVIDER: OpenCodeProviderId = 'openai'

export const DEFAULT_OPENCODE_MODEL: Record<OpenCodeProviderId, string> = {
  openai: '',
  anthropic: '',
  gemini: '',
  groq: '',
  openrouter: '',
  vercel: '',
  synthetic: '',
  zai: '',
  huggingface: '',
  cerebras: '',
  vertexai: '',
  bedrock: '',
  azure: '',
  'openai-compat': '',
  'anthropic-compat': '',
  zen: '',
}

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
