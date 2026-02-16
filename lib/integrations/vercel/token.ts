import 'server-only'

import { getServerSession } from '@/lib/session/get-server-session'
import { getDecryptedToken } from '../connection-manager'

export async function getUserVercelToken(): Promise<string | null> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }

  return getDecryptedToken(session.user.id, 'vercel')
}

export async function getVercelTokenForUser(userId: string): Promise<string | null> {
  return getDecryptedToken(userId, 'vercel')
}
