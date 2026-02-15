import { db } from '@/lib/db/client'
import { accounts, githubInstallations } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'
import { SignJWT, importPKCS8 } from 'jose'

const GITHUB_APP_JWT_TTL_SECONDS = 10 * 60

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

async function createGitHubAppJwt(): Promise<string | null> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!appId || !privateKey) {
    return null
  }

  const key = await importPKCS8(privateKey, 'RS256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + GITHUB_APP_JWT_TTL_SECONDS)
    .setIssuer(appId)
    .sign(key)
}

async function fetchInstallationAccessToken(installationId: string): Promise<string | null> {
  const appJwt = await createGitHubAppJwt()
  if (!appJwt) {
    return null
  }

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    console.error('[GitHub] Failed to fetch installation access token')
    return null
  }

  const data = (await response.json()) as { token?: string }
  return data.token ?? null
}

export interface ResolveAccessTokenParams {
  userId: string
  repoUrl?: string
  installationId?: string
}

export async function resolveGitHubAccessToken({
  userId,
  repoUrl,
  installationId,
}: ResolveAccessTokenParams): Promise<string | null> {
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')))
    .limit(1)

  if (account[0]?.accessToken) {
    return decrypt(account[0].accessToken)
  }

  let resolvedInstallationId = installationId
  if (!resolvedInstallationId && repoUrl) {
    const installation = await db
      .select({ installationId: githubInstallations.installationId })
      .from(githubInstallations)
      .where(and(eq(githubInstallations.userId, userId), eq(githubInstallations.repoUrl, repoUrl)))
      .limit(1)

    resolvedInstallationId = installation[0]?.installationId
  }

  if (!resolvedInstallationId) {
    return null
  }

  return fetchInstallationAccessToken(resolvedInstallationId)
}
