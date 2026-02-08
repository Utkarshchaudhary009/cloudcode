import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { reviews, reviewRules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { ReviewFinding } from '@/lib/db/schema'

export const handlePrReview = inngest.createFunction(
  {
    id: 'handle-pr-review',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: 'pr/review.requested' },
  async ({ event, step }: { event: any; step: any }) => {
    const { userId, repoUrl, prNumber, headSha, prTitle, prAuthor, baseBranch, headBranch, installationId } = event.data

    const existingReview = await step.run('check-existing', async () => {
      const existing = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.repoUrl, repoUrl), eq(reviews.prNumber, prNumber), eq(reviews.headSha, headSha)))
        .limit(1)
      return existing[0]
    })

    if (existingReview) {
      return { message: 'Review already exists', reviewId: existingReview.id }
    }

    const reviewId = await step.run('create-review', async () => {
      const id = nanoid()
      await db.insert(reviews).values({
        id,
        userId,
        repoUrl,
        prNumber,
        prTitle,
        prAuthor,
        headSha,
        baseBranch,
        headBranch,
        status: 'in_progress',
        startedAt: new Date(),
      })
      return id
    })

    const diff = await step.run('fetch-diff', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/github/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, repoUrl, prNumber, installationId }),
      })
      if (!response.ok) {
        throw new Error('Failed to fetch diff')
      }
      return response.json()
    })

    const rules = await step.run('fetch-rules', async () => {
      return await db
        .select()
        .from(reviewRules)
        .where(and(eq(reviewRules.userId, userId), eq(reviewRules.enabled, true)))
    })

    const findings = await step.run('ai-review', async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reviews/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diff,
            rules,
            repoUrl,
            prTitle,
          }),
        },
      )
      if (!response.ok) {
        throw new Error('Failed to analyze review')
      }
      return response.json()
    })

    await step.run('save-findings', async () => {
      await db
        .update(reviews)
        .set({
          status: 'completed',
          summary: findings.summary,
          findings: findings.items,
          score: findings.score,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId))
    })

    await step.sendEvent('post-comments', {
      name: 'review/post-comments',
      data: {
        reviewId,
        userId,
        repoUrl,
        prNumber,
        findings: findings.items,
      },
    })

    return { reviewId, findingsCount: findings.items?.length || 0, score: findings.score }
  },
)
