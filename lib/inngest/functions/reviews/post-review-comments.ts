import { inngest } from '../../client'
import { Octokit } from '@octokit/rest'
import { resolveGitHubAccessToken, parseGitHubRepoUrl } from '@/lib/utils/github'

export const postReviewComments = inngest.createFunction(
  {
    id: 'post-review-comments',
    retries: 3,
  },
  { event: 'review/post-comments' },
  async ({ event, step }: { event: any; step: any }) => {
    const { reviewId, userId, repoUrl, prNumber, findings } = event.data

    const accessToken = await step.run('get-access-token', async () => {
      return resolveGitHubAccessToken({ userId, repoUrl })
    })

    if (!accessToken) {
      throw new Error('GitHub access token not available')
    }

    const octokit = new Octokit({ auth: accessToken })

    const parsed = parseGitHubRepoUrl(repoUrl)
    if (!parsed) {
      throw new Error('Invalid repository URL')
    }
    const { owner, repo } = parsed

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
