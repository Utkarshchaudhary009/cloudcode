import 'server-only'

import type { TokenProvider, ProviderUser } from '../types'

export async function validateVercelToken(accessToken: string, _teamId?: string): Promise<ProviderUser> {
  const { Vercel } = await import('@vercel/sdk')
  const client = new Vercel({ bearerToken: accessToken })

  const response = await client.user.getAuthUser()

  if (!response?.user) {
    throw new Error('Invalid token')
  }

  const { user } = response

  return {
    externalId: user.id,
    username: user.username,
    email: user.email ?? null,
    name: user.name ?? null,
    avatarUrl: user.avatar ? `https://vercel.com/api/www/avatar/${user.avatar}?size=64` : null,
  }
}

export const vercelProvider: TokenProvider = {
  id: 'vercel',
  name: 'Vercel',

  token: {
    createUrl: 'https://vercel.com/account/settings/tokens',
    scopes: ['deployment', 'project', 'user'],
  },

  validateToken: validateVercelToken,
}
