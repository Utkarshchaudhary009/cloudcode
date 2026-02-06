import 'server-only'

import { db } from '@/lib/db/client'
import { keys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { decrypt } from '@/lib/crypto'

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

/**
 * Get API keys for the currently authenticated user
 * Returns user's keys if available, otherwise falls back to system env vars
 */
export async function getUserApiKeys(): Promise<{
  OPENAI_API_KEY: string | undefined
  GEMINI_API_KEY: string | undefined
  CURSOR_API_KEY: string | undefined
  ANTHROPIC_API_KEY: string | undefined
  AI_GATEWAY_API_KEY: string | undefined
  GROQ_API_KEY: string | undefined
  OPENROUTER_API_KEY: string | undefined
  VERCEL_API_KEY: string | undefined
  SYNTHETIC_API_KEY: string | undefined
  ZAI_API_KEY: string | undefined
  HF_TOKEN: string | undefined
  CEREBRAS_API_KEY: string | undefined
  VERTEXAI_PROJECT: string | undefined
  AWS_ACCESS_KEY_ID: string | undefined
  AZURE_OPENAI_API_KEY: string | undefined
}> {
  const session = await getServerSession()

  // Default to system keys
  const apiKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    VERCEL_API_KEY: process.env.VERCEL_API_KEY,
    SYNTHETIC_API_KEY: process.env.SYNTHETIC_API_KEY,
    ZAI_API_KEY: process.env.ZAI_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    VERTEXAI_PROJECT: process.env.VERTEXAI_PROJECT,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  }

  if (!session?.user?.id) {
    return apiKeys
  }

  try {
    const userKeys = await db.select().from(keys).where(eq(keys.userId, session.user.id))

    userKeys.forEach((key) => {
      const decryptedValue = decrypt(key.value)

      switch (key.provider) {
        case 'openai':
          apiKeys.OPENAI_API_KEY = decryptedValue
          break
        case 'gemini':
          apiKeys.GEMINI_API_KEY = decryptedValue
          break
        case 'cursor':
          apiKeys.CURSOR_API_KEY = decryptedValue
          break
        case 'anthropic':
          apiKeys.ANTHROPIC_API_KEY = decryptedValue
          break
        case 'aigateway':
          apiKeys.AI_GATEWAY_API_KEY = decryptedValue
          break
        case 'groq':
          apiKeys.GROQ_API_KEY = decryptedValue
          break
        case 'openrouter':
          apiKeys.OPENROUTER_API_KEY = decryptedValue
          break
        case 'vercel':
          apiKeys.VERCEL_API_KEY = decryptedValue
          break
        case 'synthetic':
          apiKeys.SYNTHETIC_API_KEY = decryptedValue
          break
        case 'zai':
          apiKeys.ZAI_API_KEY = decryptedValue
          break
        case 'huggingface':
          apiKeys.HF_TOKEN = decryptedValue
          break
        case 'cerebras':
          apiKeys.CEREBRAS_API_KEY = decryptedValue
          break
        case 'vertexai':
          apiKeys.VERTEXAI_PROJECT = decryptedValue
          break
        case 'bedrock':
          apiKeys.AWS_ACCESS_KEY_ID = decryptedValue
          break
        case 'azure':
          apiKeys.AZURE_OPENAI_API_KEY = decryptedValue
          break
        case 'openai-compat':
          apiKeys.OPENAI_API_KEY = decryptedValue
          break
        case 'anthropic-compat':
          apiKeys.ANTHROPIC_API_KEY = decryptedValue
          break
      }
    })
  } catch (error) {
    console.error('Error fetching user API keys:', error)
    // Fall back to system keys on error
  }

  return apiKeys
}

/**
 * Get a specific API key for a provider
 * Returns user's key if available, otherwise falls back to system env var
 */
export async function getUserApiKey(provider: Provider): Promise<string | undefined> {
  const session = await getServerSession()

  // Default to system key
  const systemKeys = {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    cursor: process.env.CURSOR_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    aigateway: process.env.AI_GATEWAY_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    vercel: process.env.VERCEL_API_KEY,
    synthetic: process.env.SYNTHETIC_API_KEY,
    zai: process.env.ZAI_API_KEY,
    huggingface: process.env.HF_TOKEN,
    cerebras: process.env.CEREBRAS_API_KEY,
    vertexai: process.env.VERTEXAI_PROJECT,
    bedrock: process.env.AWS_ACCESS_KEY_ID,
    azure: process.env.AZURE_OPENAI_API_KEY,
    'openai-compat': process.env.OPENAI_API_KEY,
    'anthropic-compat': process.env.ANTHROPIC_API_KEY,
  }

  if (!session?.user?.id) {
    return systemKeys[provider]
  }

  try {
    const userKey = await db
      .select({ value: keys.value })
      .from(keys)
      .where(and(eq(keys.userId, session.user.id), eq(keys.provider, provider)))
      .limit(1)

    if (userKey[0]?.value) {
      return decrypt(userKey[0].value)
    }
  } catch (error) {
    console.error('Error fetching user API key:', error)
  }

  return systemKeys[provider]
}
