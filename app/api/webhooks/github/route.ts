import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db/client'
import { githubInstallations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'GitHub webhook secret not configured' }, { status: 500 })
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET).update(body).digest('hex')}`

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = request.headers.get('x-github-event')
  const payload = JSON.parse(body)

  if (event === 'pull_request') {
    const action = payload.action

    if (['opened', 'synchronize', 'reopened'].includes(action)) {
      const repoUrl = payload.repository.html_url
      const prNumber = payload.pull_request.number

      const installation = await db
        .select()
        .from(githubInstallations)
        .where(and(eq(githubInstallations.repoUrl, repoUrl), eq(githubInstallations.autoReviewEnabled, true)))
        .limit(1)

      if (installation[0]) {
        if (payload.pull_request.draft && !installation[0].reviewOnDraft) {
          return NextResponse.json({ message: 'Skipping draft PR' })
        }

        await inngest.send({
          name: 'pr/review.requested',
          data: {
            userId: installation[0].userId,
            repoUrl,
            prNumber,
            prTitle: payload.pull_request.title,
            prAuthor: payload.pull_request.user.login,
            headSha: payload.pull_request.head.sha,
            baseBranch: payload.pull_request.base.ref,
            headBranch: payload.pull_request.head.ref,
            installationId: installation[0].installationId,
          },
        })

        return NextResponse.json({ message: 'Review triggered' })
      }
    }
  }

  return NextResponse.json({ message: 'Event ignored' })
}
