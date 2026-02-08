import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { accounts, githubInstallations } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'
import { SignJWT, importPKCS8 } from 'jose'

const GITHUB_APP_JWT_TTL_SECONDS = 10 * 60

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
    return null
  }

  const data = (await response.json()) as { token?: string }
  return data.token ?? null
}

async function resolveAccessToken({
  userId,
  repoUrl,
  installationId,
}: {
  userId: string
  repoUrl: string
  installationId?: string
}): Promise<string | null> {
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')))
    .limit(1)

  if (account[0]?.accessToken) {
    return decrypt(account[0].accessToken)
  }

  let resolvedInstallationId = installationId
  if (!resolvedInstallationId) {
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

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { userId, repoUrl, prNumber, installationId } = body

  if (!userId || !repoUrl || !prNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const accessToken = await resolveAccessToken({ userId, repoUrl, installationId })
  if (!accessToken) {
    return NextResponse.json({ error: 'GitHub credentials not available' }, { status: 404 })
  }

  const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!urlMatch) {
    return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 })
  }

  const [, owner, repo] = urlMatch

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3.diff',
    },
  })

  if (!response.ok) {
    await response.text()
    console.error('GitHub API error')
    return NextResponse.json({ error: 'Failed to fetch PR diff' }, { status: response.status })
  }

  const diff = await response.text()

  return NextResponse.json({ diff })
}
