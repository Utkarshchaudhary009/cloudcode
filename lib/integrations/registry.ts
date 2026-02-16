import type { TokenProvider, DeploymentProvider, ProviderMetadata } from './types'
import { vercelProvider } from './vercel'

const providerMap: Partial<Record<DeploymentProvider, TokenProvider>> = {
  vercel: vercelProvider,
}

export const providers = providerMap as Record<DeploymentProvider, TokenProvider>

export type ProviderId = keyof typeof providers

export const availableProviders: ProviderMetadata[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy and monitor Next.js applications',
    tokenCreateUrl: 'https://vercel.com/account/settings/tokens',
    tokenNote: 'Full Account',
  },
]

export const providerMetadata: Record<DeploymentProvider, ProviderMetadata | undefined> = {
  vercel: availableProviders.find((p) => p.id === 'vercel'),
  cloudflare: undefined,
  render: undefined,
}

export function getProvider(id: ProviderId): TokenProvider | undefined {
  return providers[id]
}

export function getProviderMetadata(id: DeploymentProvider): ProviderMetadata | undefined {
  return providerMetadata[id]
}

export function isProviderId(value: string): value is ProviderId {
  return value in providers && providers[value as ProviderId] !== undefined
}
