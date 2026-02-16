import type { TokenProvider, DeploymentProvider, ProviderMetadata } from './types'
import { vercelProvider } from './vercel'
import { availableProviders, providerMetadata, getProviderMetadata as getMetadata } from './metadata'

const providerMap: Partial<Record<DeploymentProvider, TokenProvider>> = {
  vercel: vercelProvider,
}

export const providers = providerMap as Record<DeploymentProvider, TokenProvider>

export type ProviderId = keyof typeof providers

export { availableProviders, providerMetadata }

export function getProvider(id: ProviderId): TokenProvider | undefined {
  return providers[id]
}

export function getProviderMetadata(id: DeploymentProvider): ProviderMetadata | undefined {
  return getMetadata(id)
}

export function isProviderId(value: string): value is ProviderId {
  return value in providers && providers[value as ProviderId] !== undefined
}
