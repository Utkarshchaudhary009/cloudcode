import { z } from 'zod'
import {
  DEFAULT_OPENCODE_PROVIDER,
  normalizeOpenCodeProvider,
  SUPPORTED_OPENCODE_PROVIDER_INPUTS,
  SUPPORTED_OPENCODE_PROVIDERS,
} from './providers'

export const openCodeProviderInputSchema = z.enum(SUPPORTED_OPENCODE_PROVIDER_INPUTS)

export const openCodeProviderSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const parsed = openCodeProviderInputSchema.safeParse(value)
  if (!parsed.success) return value
  return normalizeOpenCodeProvider(parsed.data)
}, z.enum(SUPPORTED_OPENCODE_PROVIDERS).default(DEFAULT_OPENCODE_PROVIDER))
