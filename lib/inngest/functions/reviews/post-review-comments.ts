import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'
import { Octokit } from '@octokit/rest'

export const postReviewComments = inngest.createFunction(
  {
    id: 'post-review-comments',
    retries: 3,
  },
  { event: 'review/post-comments' },
  async ({ event, step }: { event: any; step: any }) => {
    const { reviewId, userId, repoUrl, prNumber, findings } = event.data

    const account = await step.run('get-github-account', async () => {
      const accountsResult = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1)
      return accountsResult[0]
    })

    if (!account) {
      throw new Error('GitHub account not found')
    }

    const accessToken = decrypt(account.accessToken)
    const octokit = new Octokit({
      auth: accessToken,
    })

    const [owner, repo] = repoUrl.split('/').slice(-2)

    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    })

    await step.run('post-comments', async () => {
      for (const finding of findings || []) {
        if (!finding) continue

        const commentBody = `## ${finding.severity.toUpperCase()}\n\n${finding.message}\n\n${
          finding.suggestion ? `**Suggestion:** ${finding.suggestion}` : ''
        }`

        if (finding.file && finding.line) {
          await octokit.rest.pulls.createReviewComment({
            owner,
            repo,
            pull_number: prNumber,
            body: commentBody,
            commit_id: pr.head.sha,
            path: finding.file,
            line: finding.line,
            side: 'RIGHT',
          })
        } else {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: commentBody,
          })
        }
      }
    })

    return { reviewId, commentsPosted: findings?.length || 0 }
  },
)
