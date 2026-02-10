import 'server-only'

import { db } from '@/lib/db/client'
import { keys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { decrypt } from '@/lib/crypto'

type Provider =
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

/**
 * Get API keys for the currently authenticated user
 * Returns user's keys if available, otherwise falls back to system env vars
 */
export async function getUserApiKeys(): Promise<{
  OPENAI_API_KEY: string | undefined
  ANTHROPIC_API_KEY: string | undefined
  GOOGLE_API_KEY: string | undefined
  GOOGLE_VERTEX_PROJECT: string | undefined
  GROQ_API_KEY: string | undefined
  CEREBRAS_API_KEY: string | undefined
  OPENROUTER_API_KEY: string | undefined
  HF_TOKEN: string | undefined
  VERCEL_API_KEY: string | undefined
  ZAI_API_KEY: string | undefined
  MINIMAX_API_KEY: string | undefined
  AZURE_OPENAI_API_KEY: string | undefined
  OPENCODE_API_KEY: string | undefined
  COHERE_API_KEY: string | undefined
  DEEPSEEK_API_KEY: string | undefined
  MOONSHOT_API_KEY: string | undefined
  ZHIPU_API_KEY: string | undefined
}> {
  const session = await getServerSession()

  // Default to system keys
  const apiKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT || process.env.VERTEXAI_PROJECT,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    VERCEL_API_KEY: process.env.VERCEL_API_KEY,
    ZAI_API_KEY: process.env.ZAI_API_KEY,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
    COHERE_API_KEY: process.env.COHERE_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
  }

  if (!session?.user?.id) {
    return apiKeys
  }

  try {
    const userKeys = await db.select().from(keys).where(eq(keys.userId, session.user.id))

    userKeys.forEach((key) => {
      const decryptedValue = decrypt(key.value)

      // Handle both new and legacy provider keys from DB
      switch (key.provider) {
        case 'openai':
          apiKeys.OPENAI_API_KEY = decryptedValue
          break
        case 'anthropic':
          apiKeys.ANTHROPIC_API_KEY = decryptedValue
          break
        case 'google':
        case 'gemini': // Legacy
          apiKeys.GOOGLE_API_KEY = decryptedValue
          break
        case 'google-vertex':
        case 'vertexai': // Legacy
          apiKeys.GOOGLE_VERTEX_PROJECT = decryptedValue
          break
        case 'groq':
          apiKeys.GROQ_API_KEY = decryptedValue
          break
        case 'cerebras':
          apiKeys.CEREBRAS_API_KEY = decryptedValue
          break
        case 'openrouter':
          apiKeys.OPENROUTER_API_KEY = decryptedValue
          break
        case 'huggingface':
          apiKeys.HF_TOKEN = decryptedValue
          break
        case 'vercel':
          apiKeys.VERCEL_API_KEY = decryptedValue
          break
        case 'zai':
          apiKeys.ZAI_API_KEY = decryptedValue
          break
        case 'minimax':
          apiKeys.MINIMAX_API_KEY = decryptedValue
          break
        case 'azure':
          apiKeys.AZURE_OPENAI_API_KEY = decryptedValue
          break
        case 'opencode':
          apiKeys.OPENCODE_API_KEY = decryptedValue
          break
        case 'cohere':
          apiKeys.COHERE_API_KEY = decryptedValue
          break
        case 'deepseek':
          apiKeys.DEEPSEEK_API_KEY = decryptedValue
          break
        case 'moonshotai':
          apiKeys.MOONSHOT_API_KEY = decryptedValue
          break
        case 'zhipuai':
          apiKeys.ZHIPU_API_KEY = decryptedValue
          break
      }
    })
  } catch (error) {
    console.error('Error fetching user API keys:', error)
  }

  return apiKeys
}

/**
 * Get API keys for a specific user by ID (for background jobs where there's no session)
 * Returns user's keys if available, otherwise falls back to system env vars
 */
export async function getUserApiKeysForUser(userId: string): Promise<{
  OPENAI_API_KEY: string | undefined
  ANTHROPIC_API_KEY: string | undefined
  GOOGLE_API_KEY: string | undefined
  GOOGLE_VERTEX_PROJECT: string | undefined
  GROQ_API_KEY: string | undefined
  CEREBRAS_API_KEY: string | undefined
  OPENROUTER_API_KEY: string | undefined
  HF_TOKEN: string | undefined
  VERCEL_API_KEY: string | undefined
  ZAI_API_KEY: string | undefined
  MINIMAX_API_KEY: string | undefined
  AZURE_OPENAI_API_KEY: string | undefined
  OPENCODE_API_KEY: string | undefined
  COHERE_API_KEY: string | undefined
  DEEPSEEK_API_KEY: string | undefined
  MOONSHOT_API_KEY: string | undefined
  ZHIPU_API_KEY: string | undefined
}> {
  // Default to system keys
  const apiKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT || process.env.VERTEXAI_PROJECT,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    VERCEL_API_KEY: process.env.VERCEL_API_KEY,
    ZAI_API_KEY: process.env.ZAI_API_KEY,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
    COHERE_API_KEY: process.env.COHERE_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
  }

  try {
    const userKeys = await db.select().from(keys).where(eq(keys.userId, userId))

    userKeys.forEach((key) => {
      const decryptedValue = decrypt(key.value)

      switch (key.provider) {
        case 'openai':
          apiKeys.OPENAI_API_KEY = decryptedValue
          break
        case 'anthropic':
          apiKeys.ANTHROPIC_API_KEY = decryptedValue
          break
        case 'google':
        case 'gemini':
          apiKeys.GOOGLE_API_KEY = decryptedValue
          break
        case 'google-vertex':
        case 'vertexai':
          apiKeys.GOOGLE_VERTEX_PROJECT = decryptedValue
          break
        case 'groq':
          apiKeys.GROQ_API_KEY = decryptedValue
          break
        case 'cerebras':
          apiKeys.CEREBRAS_API_KEY = decryptedValue
          break
        case 'openrouter':
          apiKeys.OPENROUTER_API_KEY = decryptedValue
          break
        case 'huggingface':
          apiKeys.HF_TOKEN = decryptedValue
          break
        case 'vercel':
          apiKeys.VERCEL_API_KEY = decryptedValue
          break
        case 'zai':
          apiKeys.ZAI_API_KEY = decryptedValue
          break
        case 'minimax':
          apiKeys.MINIMAX_API_KEY = decryptedValue
          break
        case 'azure':
          apiKeys.AZURE_OPENAI_API_KEY = decryptedValue
          break
        case 'opencode':
          apiKeys.OPENCODE_API_KEY = decryptedValue
          break
        case 'cohere':
          apiKeys.COHERE_API_KEY = decryptedValue
          break
        case 'deepseek':
          apiKeys.DEEPSEEK_API_KEY = decryptedValue
          break
        case 'moonshotai':
          apiKeys.MOONSHOT_API_KEY = decryptedValue
          break
        case 'zhipuai':
          apiKeys.ZHIPU_API_KEY = decryptedValue
          break
      }
    })
  } catch (error) {
    console.error('Error fetching user API keys:', error)
  }

  return apiKeys
}

/**
 * Get a specific API key for a provider
 * Returns user's key if available, otherwise falls back to system env var
 */
export async function getUserApiKey(provider: Provider): Promise<string | undefined> {
  const session = await getServerSession()

  // Map requested provider to environment variable legacy fallbacks if needed
  let systemValue: string | undefined
  let legacyProviderName = provider as string

  switch (provider) {
    case 'openai':
      systemValue = process.env.OPENAI_API_KEY
      break
    case 'anthropic':
      systemValue = process.env.ANTHROPIC_API_KEY
      break
    case 'google':
      systemValue = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
      legacyProviderName = 'gemini'
      break
    case 'google-vertex':
      systemValue = process.env.GOOGLE_VERTEX_PROJECT || process.env.VERTEXAI_PROJECT
      legacyProviderName = 'vertexai'
      break
    case 'groq':
      systemValue = process.env.GROQ_API_KEY
      break
    case 'cerebras':
      systemValue = process.env.CEREBRAS_API_KEY
      break
    case 'openrouter':
      systemValue = process.env.OPENROUTER_API_KEY
      break
    case 'huggingface':
      systemValue = process.env.HF_TOKEN
      break
    case 'vercel':
      systemValue = process.env.VERCEL_API_KEY
      break
    case 'zai':
      systemValue = process.env.ZAI_API_KEY
      break
    case 'minimax':
      systemValue = process.env.MINIMAX_API_KEY
      break
    case 'azure':
      systemValue = process.env.AZURE_OPENAI_API_KEY
      break
    case 'opencode':
      systemValue = process.env.OPENCODE_API_KEY
      break
    case 'cohere':
      systemValue = process.env.COHERE_API_KEY
      break
    case 'deepseek':
      systemValue = process.env.DEEPSEEK_API_KEY
      break
    case 'moonshotai':
      systemValue = process.env.MOONSHOT_API_KEY
      break
    case 'zhipuai':
      systemValue = process.env.ZHIPU_API_KEY
      break
  }

  if (!session?.user?.id) {
    return systemValue
  }

  try {
    const userKeys = await db
      .select({ value: keys.value, provider: keys.provider })
      .from(keys)
      .where(eq(keys.userId, session.user.id))

    // Find key matching either the current provider name or its legacy name
    const matchedKey = userKeys.find((k) => k.provider === provider || k.provider === legacyProviderName)

    if (matchedKey) {
      return decrypt(matchedKey.value)
    }
  } catch (error) {
    console.error('Error fetching user API key:', error)
  }

  return systemValue
}
