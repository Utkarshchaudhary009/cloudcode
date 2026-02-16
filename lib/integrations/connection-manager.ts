import 'server-only'

import { db } from '@/lib/db/client'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt } from '@/lib/crypto'
import { nanoid } from 'nanoid'
import type { ProviderUser, DeploymentProvider } from './types'

export async function getConnection(userId: string, provider: DeploymentProvider) {
  const result = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))

  return result[0] ?? null
}

export async function getAllConnections(userId: string) {
  return db.select().from(integrations).where(eq(integrations.userId, userId))
}

export async function connect(
  userId: string,
  provider: DeploymentProvider,
  accessToken: string,
  userInfo: ProviderUser,
  teamId?: string,
  teamSlug?: string,
): Promise<string> {
  const existing = await getConnection(userId, provider)

  const encryptedToken = encrypt(accessToken)

  if (existing) {
    await db
      .update(integrations)
      .set({
        accessToken: encryptedToken,
        externalUserId: userInfo.externalId,
        username: userInfo.username,
        teamId: teamId ?? null,
        teamSlug: teamSlug ?? null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id))

    return existing.id
  }

  const id = nanoid()
  await db.insert(integrations).values({
    id,
    userId,
    provider,
    accessToken: encryptedToken,
    externalUserId: userInfo.externalId,
    username: userInfo.username,
    teamId: teamId ?? null,
    teamSlug: teamSlug ?? null,
  })

  return id
}

export async function disconnect(userId: string, provider: DeploymentProvider): Promise<void> {
  await db.delete(integrations).where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
}

export async function getDecryptedToken(userId: string, provider: DeploymentProvider): Promise<string | null> {
  const { decrypt } = await import('@/lib/crypto')
  const connection = await getConnection(userId, provider)

  if (!connection) return null

  return decrypt(connection.accessToken)
}
