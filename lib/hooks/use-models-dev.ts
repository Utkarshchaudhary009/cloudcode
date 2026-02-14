import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  OPENCODE_PROVIDER_LABELS,
  SUPPORTED_OPENCODE_PROVIDERS,
  type OpenCodeProviderId,
} from '@/lib/opencode/providers'

const MODELS_DEV_API_URL = 'https://models.dev/api.json'
const MODELS_DEV_LOGO_BASE_URL = 'https://models.dev/logos'
const CACHE_KEY = 'models-dev-cache-v2'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24

const MODELS_DEV_PROVIDER_ID_MAP: Record<string, OpenCodeProviderId> = {
  gemini: 'google',
  vertexai: 'google-vertex',
}

export type ModelsDevProviderOption = {
  value: OpenCodeProviderId
  label: string
  logoUrl: string
}

export type ModelsDevModelOption = {
  value: string
  label: string
}

type ModelsDevCache = {
  savedAt: number
  providers: ModelsDevProviderOption[]
  modelsByProvider: Record<OpenCodeProviderId, ModelsDevModelOption[]>
  defaultModels: Record<OpenCodeProviderId, string>
}

const getFallbackModelsByProvider = (): Record<OpenCodeProviderId, ModelsDevModelOption[]> => {
  return Object.fromEntries(
    SUPPORTED_OPENCODE_PROVIDERS.map((provider) => [provider, [] as ModelsDevModelOption[]]),
  ) as Record<OpenCodeProviderId, ModelsDevModelOption[]>
}

const getFallbackProviders = (): ModelsDevProviderOption[] => {
  return SUPPORTED_OPENCODE_PROVIDERS.map((provider) => ({
    value: provider,
    label: OPENCODE_PROVIDER_LABELS[provider] ?? provider,
    logoUrl: `${MODELS_DEV_LOGO_BASE_URL}/${provider}.svg`,
  }))
}

const getFallbackDefaultModels = (): Record<OpenCodeProviderId, string> => {
  return Object.fromEntries(SUPPORTED_OPENCODE_PROVIDERS.map((provider) => [provider, ''])) as Record<
    OpenCodeProviderId,
    string
  >
}

const readCache = (): ModelsDevCache | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ModelsDevCache
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeCache = (payload: ModelsDevCache) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
}

const normalizeLabel = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

const resolveProviderId = (providerId: string) => {
  const mapped = MODELS_DEV_PROVIDER_ID_MAP[providerId]
  if (mapped) {
    return { opencodeId: mapped, logoId: providerId }
  }
  if (SUPPORTED_OPENCODE_PROVIDERS.includes(providerId as OpenCodeProviderId)) {
    return { opencodeId: providerId as OpenCodeProviderId, logoId: providerId }
  }
  return null
}

const extractProviders = (data: unknown): Array<{ id: OpenCodeProviderId; label: string; logoId: string }> => {
  if (!data || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  let providersValue = record.providers
  if (!providersValue) {
    providersValue = record
  }
  if (Array.isArray(providersValue)) {
    return providersValue
      .map((provider) => {
        if (!provider || typeof provider !== 'object') return null
        const entry = provider as Record<string, unknown>
        const rawId = normalizeLabel(entry.id, normalizeLabel(entry.provider, ''))
        if (!rawId) return null
        const resolved = resolveProviderId(rawId)
        if (!resolved) return null
        const label = normalizeLabel(entry.name, normalizeLabel(entry.label, rawId))
        return { id: resolved.opencodeId, label, logoId: resolved.logoId }
      })
      .filter((provider): provider is { id: OpenCodeProviderId; label: string; logoId: string } => Boolean(provider))
  }
  if (providersValue && typeof providersValue === 'object') {
    return Object.entries(providersValue as Record<string, unknown>)
      .map(([rawId, value]) => {
        const resolved = resolveProviderId(rawId)
        if (!resolved) return null
        const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
        const label = normalizeLabel(entry.name, normalizeLabel(entry.label, rawId))
        return { id: resolved.opencodeId, label, logoId: resolved.logoId }
      })
      .filter((provider): provider is { id: OpenCodeProviderId; label: string; logoId: string } => Boolean(provider))
  }
  return []
}

const resolveModelsDevProviderId = (providerId: string) => {
  return resolveProviderId(providerId)?.opencodeId ?? null
}

const getProviderLabelFallback = (providerId: OpenCodeProviderId, label: string) => {
  return label || OPENCODE_PROVIDER_LABELS[providerId] || providerId
}

const extractProvidersWithFallbacks = (data: unknown) => {
  const providers = extractProviders(data)
  const providersById = new Map<OpenCodeProviderId, { label: string; logoId: string }>()
  providers.forEach((provider) => {
    providersById.set(provider.id, { label: provider.label, logoId: provider.logoId })
  })

  return SUPPORTED_OPENCODE_PROVIDERS.map((provider) => {
    const fallbackLabel = OPENCODE_PROVIDER_LABELS[provider] ?? provider
    const entry = providersById.get(provider)
    return {
      id: provider,
      label: entry ? getProviderLabelFallback(provider, entry.label) : fallbackLabel,
      logoId: entry?.logoId ?? provider,
    }
  })
}

const extractModels = (data: unknown): Array<{ id: string; providerId: string; label: string }> => {
  if (!data || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  const modelsValue = record.models
  const normalizeModel = (id: string, entry: Record<string, unknown>, parentProviderId?: string) => {
    const rawProvider =
      normalizeLabel(entry.provider, '') ||
      normalizeLabel(entry.providerId, '') ||
      normalizeLabel(entry.provider_id, '') ||
      normalizeLabel(entry.vendor, '') ||
      normalizeLabel(entry.organization, '')
    const providerId = rawProvider || (id.includes('/') ? id.split('/')[0] : '') || parentProviderId || ''
    const label = normalizeLabel(
      entry.name,
      normalizeLabel(entry.displayName, normalizeLabel(entry.display_name, normalizeLabel(entry.label, id))),
    )
    const fullId = id.includes('/') ? id : `${providerId}/${id}`
    return { id: fullId, providerId, label }
  }
  if (Array.isArray(modelsValue)) {
    return modelsValue
      .map((model) => {
        if (!model || typeof model !== 'object') return null
        const entry = model as Record<string, unknown>
        const id = normalizeLabel(entry.id, normalizeLabel(entry.model, ''))
        if (!id) return null
        return normalizeModel(id, entry)
      })
      .filter((model): model is { id: string; providerId: string; label: string } => Boolean(model))
  }
  if (modelsValue && typeof modelsValue === 'object') {
    return Object.entries(modelsValue as Record<string, unknown>).map(([id, value]) => {
      const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
      return normalizeModel(id, entry)
    })
  }

  // Fallback for new schema where models are nested under providers
  const allModels: Array<{ id: string; providerId: string; label: string }> = []
  Object.entries(record).forEach(([pKey, pValue]) => {
    if (!pValue || typeof pValue !== 'object') return
    const providerModels = (pValue as Record<string, unknown>).models

    if (providerModels && typeof providerModels === 'object' && !Array.isArray(providerModels)) {
      Object.entries(providerModels as Record<string, unknown>).forEach(([mId, mValue]) => {
        const mEntry = mValue && typeof mValue === 'object' ? (mValue as Record<string, unknown>) : {}
        const normalized = normalizeModel(mId, mEntry, pKey)
        if (normalized.id) {
          allModels.push(normalized)
        }
      })
    }
  })

  return allModels
}

const buildCatalogFromData = (data: unknown): ModelsDevCache => {
  const providers = extractProvidersWithFallbacks(data)
  const models = extractModels(data)
  const supportedProviders = new Set(SUPPORTED_OPENCODE_PROVIDERS)

  const providerOptions: ModelsDevProviderOption[] = providers.map((provider) => ({
    value: provider.id,
    label: provider.label,
    logoUrl: `${MODELS_DEV_LOGO_BASE_URL}/${provider.logoId}.svg`,
  }))

  const modelsByProvider = Object.fromEntries(
    SUPPORTED_OPENCODE_PROVIDERS.map((provider) => [provider, [] as ModelsDevModelOption[]]),
  ) as Record<OpenCodeProviderId, ModelsDevModelOption[]>

  models.forEach((model) => {
    const resolvedProviderId = resolveModelsDevProviderId(model.providerId)
    if (resolvedProviderId && supportedProviders.has(resolvedProviderId)) {
      modelsByProvider[resolvedProviderId].push({
        value: model.id,
        label: model.label,
      })
    }
  })

  SUPPORTED_OPENCODE_PROVIDERS.forEach((provider) => {
    modelsByProvider[provider].sort((a, b) => a.label.localeCompare(b.label))
  })

  const defaultModels = Object.fromEntries(SUPPORTED_OPENCODE_PROVIDERS.map((provider) => [provider, ''])) as Record<
    OpenCodeProviderId,
    string
  >
  SUPPORTED_OPENCODE_PROVIDERS.forEach((provider) => {
    const modelsForProvider = modelsByProvider[provider]
    if (modelsForProvider.length > 0) {
      defaultModels[provider] = modelsForProvider[0].value
    }
  })

  return {
    savedAt: Date.now(),
    providers: providerOptions,
    modelsByProvider,
    defaultModels,
  }
}

export const useModelsDevCatalog = () => {
  const cached = readCache()
  const [providers, setProviders] = useState<ModelsDevProviderOption[]>(
    () => cached?.providers ?? getFallbackProviders(),
  )
  const [modelsByProvider, setModelsByProvider] = useState<Record<OpenCodeProviderId, ModelsDevModelOption[]>>(
    () => cached?.modelsByProvider ?? getFallbackModelsByProvider(),
  )
  const [defaultModels, setDefaultModels] = useState<Record<OpenCodeProviderId, string>>(
    () => cached?.defaultModels ?? getFallbackDefaultModels(),
  )

  useEffect(() => {
    let isMounted = true

    const fetchCatalog = async () => {
      try {
        const response = await fetch(MODELS_DEV_API_URL)
        if (!response.ok) {
          toast.error('Failed to load models')
          return
        }
        const data = await response.json()
        const catalog = buildCatalogFromData(data)
        if (!isMounted || catalog.providers.length === 0) return
        setProviders(catalog.providers)
        setModelsByProvider(catalog.modelsByProvider)
        setDefaultModels(catalog.defaultModels)
        writeCache(catalog)
      } catch {
        toast.error('Failed to load models')
        return
      }
    }

    void fetchCatalog()

    return () => {
      isMounted = false
    }
  }, [])

  const providerLabelMap = useMemo(() => {
    return providers.reduce<Record<string, string>>((acc, provider) => {
      acc[provider.value] = provider.label
      return acc
    }, {})
  }, [providers])

  const getProviderLabel = (provider: string | null | undefined) => {
    if (!provider) return ''
    return providerLabelMap[provider] ?? OPENCODE_PROVIDER_LABELS[provider as OpenCodeProviderId] ?? provider
  }

  const getModelLabel = (provider: string | null | undefined, modelId: string | null | undefined) => {
    if (!provider || !modelId) return modelId ?? ''
    const models = modelsByProvider[provider as OpenCodeProviderId]
    const match = models?.find((model) => model.value === modelId)
    return match?.label ?? modelId
  }

  return {
    providers,
    modelsByProvider,
    defaultModels,
    getProviderLabel,
    getModelLabel,
  }
}
