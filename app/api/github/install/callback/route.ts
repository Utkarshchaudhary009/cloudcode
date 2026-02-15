import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { SignJWT, importPKCS8 } from 'jose'
import { db } from '@/lib/db/client'
import { githubInstallations } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { decryptJWE } from '@/lib/jwe/decrypt'

type InstallState = {
  userId: string
  repoUrl: string
  autoReviewEnabled: boolean
  reviewOnDraft: boolean
  returnPath: string
}

type InstallationRepo = {
  html_url?: string | null
  full_name?: string | null
  owner?: { login?: string | null } | null
  name?: string | null
}

async function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured')
  }

  const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'RS256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ iss: appId })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(key)
}

async function listInstallationRepos(installationId: number) {
  try {
    console.log('[GitHub Install] Creating JWT for installation:', installationId)
    const jwt = await createAppJwt()

    const appOctokit = new Octokit({ auth: jwt })
    console.log('[GitHub Install] Requesting installation access token')

    const installationToken = await appOctokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId,
    })

    if (!installationToken.data.token) {
      console.error('[GitHub Install] No token in installation access token response')
      return []
    }
    console.log('[GitHub Install] Installation access token obtained')

    const installationOctokit = new Octokit({ auth: installationToken.data.token })
    const repositories: InstallationRepo[] = []

    let page = 1
    while (true) {
      console.log(`[GitHub Install] Fetching repos page ${page}`)
      const response = await installationOctokit.request('GET /installation/repositories', {
        per_page: 100,
        page,
      })

      console.log(
        `[GitHub Install] Page ${page}: ${response.data.repositories.length} repos, total_count: ${response.data.total_count}`,
      )
      repositories.push(...response.data.repositories)

      if (response.data.repositories.length < 100) {
        break
      }

      page += 1
    }

    console.log(`[GitHub Install] Total repositories fetched: ${repositories.length}`)
    return repositories
  } catch (error) {
    console.error('[GitHub Install] Error in listInstallationRepos:', error)
    return []
  }
}

function buildRepoUrl(repo: InstallationRepo) {
  if (repo.html_url) {
    return repo.html_url
  }

  if (repo.full_name) {
    return `https://github.com/${repo.full_name}`
  }

  if (repo.owner?.login && repo.name) {
    return `https://github.com/${repo.owner.login}/${repo.name}`
  }

  return ''
}

async function upsertInstallationRepo(
  userId: string,
  installationId: string,
  repoUrl: string,
  autoReviewEnabled: boolean,
  reviewOnDraft: boolean,
) {
  const existing = await db
    .select({ id: githubInstallations.id })
    .from(githubInstallations)
    .where(and(eq(githubInstallations.userId, userId), eq(githubInstallations.repoUrl, repoUrl)))
    .limit(1)

  if (existing[0]) {
    await db
      .update(githubInstallations)
      .set({
        installationId,
        autoReviewEnabled,
        reviewOnDraft,
        updatedAt: new Date(),
      })
      .where(eq(githubInstallations.id, existing[0].id))
    return
  }

  await db.insert(githubInstallations).values({
    id: nanoid(),
    userId,
    installationId,
    repoUrl,
    autoReviewEnabled,
    reviewOnDraft,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const installationIdParam = searchParams.get('installation_id')
    const stateParam = searchParams.get('state')

    const fallbackRedirect = new URL('/settings/integrations', request.url)

    if (!installationIdParam || !stateParam) {
      console.warn('Missing installation_id or state in GitHub callback')
      fallbackRedirect.searchParams.set('installation', 'error')
      return NextResponse.redirect(fallbackRedirect)
    }

    console.log('[GitHub Install] Processing callback', {
      installationId: installationIdParam,
      hasState: !!stateParam,
    })

    const state = await decryptJWE<InstallState>(stateParam)
    if (!state?.userId) {
      console.warn('[GitHub Install] Invalid or expired state in GitHub callback')
      fallbackRedirect.searchParams.set('installation', 'error')
      return NextResponse.redirect(fallbackRedirect)
    }

    console.log('[GitHub Install] State decrypted successfully', {
      userId: state.userId,
      repoUrl: state.repoUrl,
      autoReviewEnabled: state.autoReviewEnabled,
    })

    const installationId = Number(installationIdParam)
    if (!Number.isFinite(installationId)) {
      console.warn('Invalid installation_id in GitHub callback:', installationIdParam)
      fallbackRedirect.searchParams.set('installation', 'error')
      return NextResponse.redirect(fallbackRedirect)
    }

    const repositories = await listInstallationRepos(installationId)
    console.log(`[GitHub Install] listInstallationRepos returned ${repositories.length} repos`)

    const repoUrls = repositories.map(buildRepoUrl).filter(Boolean)
    console.log(`[GitHub Install] Built ${repoUrls.length} repo URLs from API:`, repoUrls)

    const repoUrlList = repoUrls.length > 0 ? repoUrls : [state.repoUrl].filter(Boolean)
    console.log(`[GitHub Install] Final repoUrlList (${repoUrlList.length}):`, repoUrlList)

    if (repoUrlList.length === 0) {
      console.error('[GitHub Install] No repos to insert - both API response and state.repoUrl are empty')
    }

    const insertResults = await Promise.all(
      repoUrlList.map((repoUrl) =>
        upsertInstallationRepo(
          state.userId,
          installationIdParam,
          repoUrl,
          state.autoReviewEnabled ?? true,
          state.reviewOnDraft ?? false,
        ),
      ),
    )
    console.log(`[GitHub Install] Inserted/updated ${repoUrlList.length} installation records`)

    const redirectUrl = new URL(state.returnPath || '/settings/integrations', request.url)
    redirectUrl.searchParams.set('installation', 'success')
    if (state.repoUrl) {
      redirectUrl.searchParams.set('repo', state.repoUrl)
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('[GitHub Install] Error in GitHub installation callback:', error)
    console.error('[GitHub Install] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const fallbackRedirect = new URL('/settings/integrations', request.url)
    fallbackRedirect.searchParams.set('installation', 'error')
    return NextResponse.redirect(fallbackRedirect)
  }
}
