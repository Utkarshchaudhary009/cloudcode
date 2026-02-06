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

export const OPENCODE_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'vercel', label: 'Vercel AI Gateway' },
  { value: 'synthetic', label: 'Synthetic' },
  { value: 'zai', label: 'Z.ai' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'vertexai', label: 'Vertex AI' },
  { value: 'bedrock', label: 'Amazon Bedrock' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'openai-compat', label: 'OpenAI Compatible' },
  { value: 'anthropic-compat', label: 'Anthropic Compatible' },
  { value: 'zen', label: 'Zen' },
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
    { value: 'claude-opus-4-6', label: 'Opus 4.6' },
    { value: 'claude-opus-4-5', label: 'Opus 4.5' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  ],
  gemini: [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B IT' },
  ],
  openrouter: [
    { value: 'openrouter/auto', label: 'Auto' },
    { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
    { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],
  vercel: [{ value: 'auto', label: 'Auto' }],
  synthetic: [{ value: 'auto', label: 'Auto' }],
  zai: [{ value: 'auto', label: 'Auto' }],
  huggingface: [{ value: 'auto', label: 'Auto' }],
  cerebras: [{ value: 'auto', label: 'Auto' }],
  vertexai: [{ value: 'auto', label: 'Auto' }],
  bedrock: [{ value: 'auto', label: 'Auto' }],
  azure: [{ value: 'auto', label: 'Auto' }],
  'openai-compat': [{ value: 'auto', label: 'Auto' }],
  'anthropic-compat': [{ value: 'auto', label: 'Auto' }],
  zen: [{ value: 'zen-free', label: 'Zen Free' }],
}

export const DEFAULT_OPENCODE_PROVIDER: OpenCodeProviderId = 'openai'

export const DEFAULT_OPENCODE_MODEL: Record<OpenCodeProviderId, string> = {
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-pro',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openrouter/auto',
  vercel: 'auto',
  synthetic: 'auto',
  zai: 'auto',
  huggingface: 'auto',
  cerebras: 'auto',
  vertexai: 'auto',
  bedrock: 'auto',
  azure: 'auto',
  'openai-compat': 'auto',
  'anthropic-compat': 'auto',
  zen: 'zen-free',
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

export const isOpenCodeProvider = (value: string | null | undefined): value is OpenCodeProviderId => {
  if (!value) return false
  return OPENCODE_PROVIDERS.some((provider) => provider.value === value)
}
