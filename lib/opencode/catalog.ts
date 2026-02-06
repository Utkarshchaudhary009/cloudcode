import type { ProviderListResponse } from '@opencode-ai/sdk'
import {
  DEFAULT_OPENCODE_MODEL,
  DEFAULT_OPENCODE_PROVIDER,
  OPENCODE_PROVIDER_LABELS,
  OPENCODE_PROVIDERS,
  OPENCODE_PROVIDER_MODELS,
} from './providers'

export type OpenCodeProviderOption = { value: string; label: string }
export type OpenCodeProviderModelOption = { value: string; label: string }

export type OpenCodeProviderCatalog = {
  source: 'static' | 'sdk'
  providers: OpenCodeProviderOption[]
  models: Record<string, OpenCodeProviderModelOption[]>
  defaults: Record<string, string>
  connected: string[]
}

export const buildStaticCatalog = (): OpenCodeProviderCatalog => ({
  source: 'static',
  providers: OPENCODE_PROVIDERS,
  models: OPENCODE_PROVIDER_MODELS,
  defaults: DEFAULT_OPENCODE_MODEL,
  connected: [],
})

const sortByLabel = (a: OpenCodeProviderModelOption, b: OpenCodeProviderModelOption) => a.label.localeCompare(b.label)

const getProviderFallbackLabel = (providerId: string) =>
  OPENCODE_PROVIDER_LABELS[providerId as keyof typeof OPENCODE_PROVIDER_LABELS] || providerId

export const mapProviderListToCatalog = (data: ProviderListResponse): OpenCodeProviderCatalog => {
  const providers = data.all.map((provider) => ({
    value: provider.id,
    label: provider.name || getProviderFallbackLabel(provider.id),
  }))

  const models: Record<string, OpenCodeProviderModelOption[]> = {}
  for (const provider of data.all) {
    const providerModels = Object.values(provider.models || {}).map((model) => ({
      value: model.id,
      label: model.name || model.id,
    }))
    models[provider.id] = providerModels.sort(sortByLabel)
  }

  return {
    source: 'sdk',
    providers,
    models,
    defaults: data.default || {},
    connected: data.connected || [],
  }
}

export const resolveOpenCodeProvider = (value: string | null | undefined, catalog: OpenCodeProviderCatalog): string => {
  if (value && catalog.providers.some((provider) => provider.value === value)) {
    return value
  }
  if (catalog.providers.some((provider) => provider.value === DEFAULT_OPENCODE_PROVIDER)) {
    return DEFAULT_OPENCODE_PROVIDER
  }
  return catalog.providers[0]?.value || DEFAULT_OPENCODE_PROVIDER
}

export const getOpenCodeProviderModels = (providerId: string | null | undefined, catalog: OpenCodeProviderCatalog) => {
  if (!providerId) return []
  return catalog.models[providerId] || []
}

export const getDefaultOpenCodeModel = (providerId: string, catalog: OpenCodeProviderCatalog): string => {
  const fallback = catalog.defaults[providerId]
  if (fallback) return fallback
  return catalog.models[providerId]?.[0]?.value || ''
}

export const resolveOpenCodeModel = (
  providerId: string,
  catalog: OpenCodeProviderCatalog,
  preferred?: string | null,
): string => {
  const models = catalog.models[providerId] || []
  if (preferred && models.some((model) => model.value === preferred)) {
    return preferred
  }
  return getDefaultOpenCodeModel(providerId, catalog)
}

export const getOpenCodeProviderLabel = (providerId: string | null | undefined, catalog: OpenCodeProviderCatalog) => {
  if (!providerId) return null
  const entry = catalog.providers.find((provider) => provider.value === providerId)
  return entry?.label || getProviderFallbackLabel(providerId)
}

export const getOpenCodeModelLabelFromCatalog = (
  providerId: string | null | undefined,
  modelId: string | null | undefined,
  catalog: OpenCodeProviderCatalog,
) => {
  if (!modelId) return modelId || ''
  const models = getOpenCodeProviderModels(providerId, catalog)
  const match = models.find((model) => model.value === modelId)
  return match?.label || modelId
}
