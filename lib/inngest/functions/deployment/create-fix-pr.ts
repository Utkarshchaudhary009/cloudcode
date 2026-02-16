import 'server-only'

import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db/client'
import { deployments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createPullRequest } from '@/lib/github/client'

export const createFixPr = inngest.createFunction(
  {
    id: 'create-fix-pr',
    name: 'Create Fix Pull Request',
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: 'deployment-fix/create-pr' as const },
  async ({ event, step }: { event: any; step: any }) => {
    const { deploymentId, repoFullName, branchName, fixSummary, fixDetails } = event.data

    const deployment = await step.run('get-deployment', async () => {
      const results = await db.select().from(deployments).where(eq(deployments.id, deploymentId))
      return results[0]
    })

    if (!deployment) {
      console.error('Deployment not found')
      return { success: false, error: 'Deployment not found' }
    }

    const prResult = await step.run('create-pull-request', async () => {
      return createPullRequest({
        repoUrl: `https://github.com/${repoFullName}`,
        branchName,
        title: fixSummary,
        body: fixDetails,
        baseBranch: 'main',
      })
    })

    if (!prResult.success) {
      await step.run('update-status-failed', async () => {
        await db
          .update(deployments)
          .set({
            fixStatus: 'failed',
            errorMessage: prResult.error || 'Failed to create pull request',
            updatedAt: new Date(),
          })
          .where(eq(deployments.id, deploymentId))
      })

      return { success: false, error: prResult.error }
    }

    await step.run('update-deployment-pr-info', async () => {
      await db
        .update(deployments)
        .set({
          fixStatus: 'pr_created',
          prUrl: prResult.prUrl,
          prNumber: prResult.prNumber,
          fixBranchName: branchName,
          fixSummary,
          fixDetails,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, deploymentId))
    })

    return {
      success: true,
      prUrl: prResult.prUrl,
      prNumber: prResult.prNumber,
    }
  },
)
