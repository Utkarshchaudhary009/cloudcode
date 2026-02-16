import type { DeploymentProvider, ProviderMetadata } from './types'

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

export function getProviderMetadata(id: DeploymentProvider): ProviderMetadata | undefined {
  return providerMetadata[id]
}
