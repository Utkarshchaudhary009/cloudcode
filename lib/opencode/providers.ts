export type OpenCodeProviderId = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter'

export const OPENCODE_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const satisfies Array<{ value: OpenCodeProviderId; label: string }>

export const OPENCODE_PROVIDER_MODELS: Record<OpenCodeProviderId, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 mini' },
    { value: 'gpt-5-nano', label: 'GPT-5 nano' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { value: 'claude-opus-4-5', label: 'Opus 4.5' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  ],
  gemini: [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  groq: [
    { value: 'llama-3.1-70b', label: 'Llama 3.1 70B' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
    { value: 'mixtral-8x7b', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B IT' },
  ],
  openrouter: [
    { value: 'openrouter/auto', label: 'Auto' },
    { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  ],
}

export const DEFAULT_OPENCODE_PROVIDER: OpenCodeProviderId = 'openai'

export const DEFAULT_OPENCODE_MODEL: Record<OpenCodeProviderId, string> = {
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-pro',
  groq: 'llama-3.1-70b',
  openrouter: 'openrouter/auto',
}

export const OPENCODE_PROVIDER_LABELS: Record<OpenCodeProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
}

export const isOpenCodeProvider = (value: string | null | undefined): value is OpenCodeProviderId => {
  if (!value) return false
  return OPENCODE_PROVIDERS.some((provider) => provider.value === value)
}

export const normalizeOpenCodeProvider = (value: string | null | undefined): OpenCodeProviderId => {
  if (isOpenCodeProvider(value)) {
    return value
  }
  return DEFAULT_OPENCODE_PROVIDER
}

export const getOpenCodeModelLabel = (provider: string | null | undefined, modelId: string | null | undefined) => {
  if (!modelId) return modelId || ''
  const resolvedProvider = normalizeOpenCodeProvider(provider)
  const model = OPENCODE_PROVIDER_MODELS[resolvedProvider].find((entry) => entry.value === modelId)
  return model?.label || modelId
}
