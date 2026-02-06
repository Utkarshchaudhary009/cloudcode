import { NextRequest, NextResponse } from 'next/server'
import { getUserApiKey } from '@/lib/api-keys/user-keys'

type Provider =
  | 'openai'
  | 'gemini'
  | 'cursor'
  | 'anthropic'
  | 'aigateway'
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

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  cursor: 'Cursor',
  anthropic: 'Anthropic',
  aigateway: 'AI Gateway',
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
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider') || searchParams.get('agent')

    if (!provider) {
      return NextResponse.json({ error: 'Provider parameter is required' }, { status: 400 })
    }

    if (!PROVIDER_LABELS[provider as Provider]) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Check if API key is available (either user's or system)
    const apiKey = await getUserApiKey(provider as Provider)
    const hasKey = !!apiKey

    return NextResponse.json({
      success: true,
      hasKey,
      provider,
      providerName: PROVIDER_LABELS[provider as Provider],
    })
  } catch (error) {
    console.error('Error checking API key:', error)
    return NextResponse.json({ error: 'Failed to check API key' }, { status: 500 })
  }
}
