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

export const OPENCODE_PROVIDER_ALIASES = {
  gemini: 'google',
  vertexai: 'google-vertex',
  zen: 'opencode',
  'openai-compat': 'openai',
  'anthropic-compat': 'anthropic',
} as const

export type OpenCodeProviderAlias = keyof typeof OPENCODE_PROVIDER_ALIASES
export type OpenCodeProviderInput = OpenCodeProviderId | OpenCodeProviderAlias

const OPENCODE_PROVIDER_ALIAS_KEYS = Object.keys(OPENCODE_PROVIDER_ALIASES) as OpenCodeProviderAlias[]

export const SUPPORTED_OPENCODE_PROVIDER_INPUTS = [
  ...SUPPORTED_OPENCODE_PROVIDERS,
  ...OPENCODE_PROVIDER_ALIAS_KEYS,
] as const satisfies ReadonlyArray<OpenCodeProviderInput>

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
  if (isOpenCodeProvider(value)) return value
  if (value && value in OPENCODE_PROVIDER_ALIASES) {
    return OPENCODE_PROVIDER_ALIASES[value as OpenCodeProviderAlias]
  }
  return DEFAULT_OPENCODE_PROVIDER
}
