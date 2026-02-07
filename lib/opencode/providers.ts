export type OpenCodeProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'google-vertex'
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'huggingface'
  | 'vercel'
  | 'zai'
  | 'minimax'
  | 'azure'
  | 'opencode'
  | 'cohere'
  | 'deepseek'
  | 'moonshotai'
  | 'zhipuai'

export const SUPPORTED_OPENCODE_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'google-vertex',
  'groq',
  'cerebras',
  'openrouter',
  'huggingface',
  'vercel',
  'zai',
  'minimax',
  'azure',
  'opencode',
  'cohere',
  'deepseek',
  'moonshotai',
  'zhipuai',
] as const satisfies ReadonlyArray<OpenCodeProviderId>

export const DEFAULT_OPENCODE_PROVIDER: OpenCodeProviderId = 'openai'

export const OPENCODE_PROVIDER_LABELS: Record<OpenCodeProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'google-vertex': 'Vertex',
  groq: 'Groq',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
  vercel: 'Vercel AI Gateway',
  zai: 'Z.ai',
  minimax: 'MiniMax',
  azure: 'Azure',
  opencode: 'OpenCode Zen',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  moonshotai: 'Moonshot AI',
  zhipuai: 'Zhipu AI',
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
