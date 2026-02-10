import type { OpenCodeProviderId } from '@/lib/opencode/providers'

export const API_KEY_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google', placeholder: 'AIza...' },
  { id: 'google-vertex', name: 'Vertex AI', placeholder: 'vertex_...' },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...' },
  { id: 'cerebras', name: 'Cerebras', placeholder: 'csk_...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'huggingface', name: 'Hugging Face', placeholder: 'hf_...' },
  { id: 'vercel', name: 'Vercel AI Gateway', placeholder: 'vercel_...' },
  { id: 'zai', name: 'Z.ai', placeholder: 'zai_...' },
  { id: 'minimax', name: 'MiniMax', placeholder: 'minimax_...' },
  { id: 'azure', name: 'Azure OpenAI', placeholder: 'azure_...' },
  { id: 'opencode', name: 'OpenCode', placeholder: 'sk-...' },
  { id: 'cohere', name: 'Cohere', placeholder: 'cohere_...' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'deepseek_...' },
  { id: 'moonshotai', name: 'Moonshot AI', placeholder: 'moonshot_...' },
  { id: 'zhipuai', name: 'Zhipu AI', placeholder: 'zhipu_...' },
] as const satisfies ReadonlyArray<{
  id: OpenCodeProviderId
  name: string
  placeholder: string
}>

export type ApiKeyProviderId = (typeof API_KEY_PROVIDERS)[number]['id']

export const API_KEY_PROVIDER_LABELS = Object.fromEntries(
  API_KEY_PROVIDERS.map((provider) => [provider.id, provider.name]),
) as Record<ApiKeyProviderId, string>

export const API_KEY_PROVIDER_SET = new Set<ApiKeyProviderId>(API_KEY_PROVIDERS.map((provider) => provider.id))
