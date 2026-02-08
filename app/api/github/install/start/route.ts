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

  const appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) {
    return NextResponse.json({ error: 'GitHub App slug not configured' }, { status: 500 })
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
}
