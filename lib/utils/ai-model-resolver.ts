import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAzure } from '@ai-sdk/azure'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createGroq } from '@ai-sdk/groq'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createMistral } from '@ai-sdk/mistral'
import { createCohere } from '@ai-sdk/cohere'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { type OpenCodeProviderId } from '@/lib/opencode/providers'
import { type LanguageModel } from 'ai'

export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  google: 'gemini-1.5-flash',
  'google-vertex': 'gemini-1.5-flash',
  groq: 'llama-3.3-70b-versatile',
  cerebras: 'llama3.1-70b',
  openrouter: 'openai/gpt-4o-mini',
  huggingface: 'meta-llama/Llama-3.1-8B-Instruct',
  zai: 'zai-base',
  minimax: 'abab6.5-chat',
  azure: 'gpt-4o-mini',
  opencode: 'openai/gpt-4o-mini',
  cohere: 'command-r-plus',
  deepseek: 'deepseek-chat',
  moonshotai: 'moonshot-v1-8k',
  zhipuai: 'glm-4',
}

export function getAIModel(providerId: OpenCodeProviderId, apiKey?: string, modelId?: string): any {
  const model = modelId || PROVIDER_DEFAULT_MODELS[providerId] || 'gpt-4o-mini'

  switch (providerId) {
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'google':
    case 'google-vertex':
      return createGoogleGenerativeAI({ apiKey })(model)
    case 'groq':
      return createGroq({ apiKey })(model)
    case 'deepseek':
      return createDeepSeek({ apiKey })(model)
    case 'cohere':
      return createCohere({ apiKey })(model)
    case 'azure':
      return createAzure({ apiKey: apiKey })(model)
    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      })(model)
    case 'opencode':
      return createOpenAICompatible({
        name: 'opencode',
        baseURL: process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1',
        apiKey: apiKey || process.env.OPENCODE_API_KEY,
      })(model)
    case 'vercel':
      return createOpenAICompatible({
        name: 'vercel',
        baseURL: process.env.AI_GATEWAY_URL || '',
        apiKey: apiKey || process.env.AI_GATEWAY_API_KEY,
      })(model)
    default:
      // For any other provider, try to use Mistral or fallback to OpenAI
      if (providerId === ('mistral' as any)) {
        return createMistral({ apiKey })(model)
      }
      return createOpenAI({ apiKey })(model)
  }
}
