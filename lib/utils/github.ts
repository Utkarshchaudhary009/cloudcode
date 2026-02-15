import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'

export interface ParsedGitHubRepo {
  owner: string
  repo: string
}

export function parseGitHubRepoUrl(repoUrl: string): ParsedGitHubRepo | null {
  if (!repoUrl) return null

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null

  return {
    owner: match[1],
    repo: match[2].replace('.git', '').replace(/\/$/, ''),
  }
}

export function buildGitHubRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`
}

export interface ResolveAccessTokenParams {
  userId: string
}

export async function resolveGitHubAccessToken({ userId }: ResolveAccessTokenParams): Promise<string | null> {
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')))
    .limit(1)

  if (account[0]?.accessToken) {
    return decrypt(account[0].accessToken)
  }

  return null
}
