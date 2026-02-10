import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { encryptJWE } from '@/lib/jwe/encrypt'

type InstallState = {
  userId: string
  repoUrl: string
  autoReviewEnabled: boolean
  reviewOnDraft: boolean
  returnPath: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { repoUrl, autoReviewEnabled, reviewOnDraft } = (await request.json()) as {
      repoUrl?: string
      autoReviewEnabled?: boolean
      reviewOnDraft?: boolean
    }

    if (!repoUrl) {
      return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 })
    }

    const appSlug = process.env.GITHUB_APP_SLUG || 'cloudcode'
    if (!appSlug) {
      return NextResponse.json({ error: 'GitHub App slug not configured (GITHUB_APP_SLUG)' }, { status: 500 })
    }

    const jweSecret = process.env.JWE_SECRET
    if (!jweSecret) {
      return NextResponse.json({ error: 'JWE secret not configured (JWE_SECRET)' }, { status: 500 })
    }

    const state = await encryptJWE<InstallState>(
      {
        userId: session.user.id,
        repoUrl,
        autoReviewEnabled: autoReviewEnabled ?? true,
        reviewOnDraft: reviewOnDraft ?? false,
        returnPath: '/settings/integrations',
      },
      '10m',
    )

    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`)
    installUrl.searchParams.set('state', state)

    return NextResponse.json({ installUrl: installUrl.toString() })
  } catch (error) {
    console.error('Error starting GitHub App install:', error)
    const message = error instanceof Error ? error.message : 'Failed to start GitHub App install'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
