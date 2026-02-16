import type { TokenProvider, DeploymentProvider } from './types'
import { vercelProvider } from './vercel'

const providerMap: Partial<Record<DeploymentProvider, TokenProvider>> = {
  vercel: vercelProvider,
}

export const providers = providerMap as Record<DeploymentProvider, TokenProvider>

export type ProviderId = keyof typeof providers

export function getProvider(id: ProviderId): TokenProvider | undefined {
  return providers[id]
}

export function isProviderId(value: string): value is ProviderId {
  return value in providers && providers[value as ProviderId] !== undefined
}
