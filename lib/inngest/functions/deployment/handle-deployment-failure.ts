import 'server-only'

import { db } from '@/lib/db/client'
import { deployments, subscriptions, integrations, tasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBuildLogs } from '@/lib/integrations/vercel/client'
import { analyzeBuildLogs } from '@/lib/integrations/vercel/deployment/analyzer'
import { findMatchingRule } from '@/lib/integrations/vercel/deployment/rules'
import { decrypt } from '@/lib/crypto'
import { nanoid } from 'nanoid'
import { inngest } from '@/lib/inngest/client'
import type { FixStatus, ErrorType } from '@/lib/integrations/types'

async function getSubscriptionWithIntegration(subscriptionId: string) {
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId))
  const subscription = subs[0]
  if (!subscription) return null

  const ints = await db.select().from(integrations).where(eq(integrations.id, subscription.integrationId))
  const integration = ints[0]
  if (!integration) return null

  return { subscription, integration }
}

async function updateDeploymentStatus(
  deploymentId: string,
  status: FixStatus,
  updates: Partial<typeof deployments.$inferInsert> = {},
) {
  await db
    .update(deployments)
    .set({
      fixStatus: status,
      updatedAt: new Date(),
      ...updates,
    })
    .where(eq(deployments.id, deploymentId))
}

export const handleDeploymentFailure = inngest.createFunction(
  {
    id: 'handle-deployment-failure',
    name: 'Handle Deployment Failure',
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: 'deployment-failure/received' as const },
  async ({ event, step }: { event: any; step: any }) => {
    const { fixId, subscriptionId, deploymentId } = event.data

    await step.run('update-status-analyzing', async () => {
      await updateDeploymentStatus(fixId, 'analyzing', { startedAt: new Date() })
    })

    const subInfo = await step.run('get-subscription', async () => {
      return getSubscriptionWithIntegration(subscriptionId)
    })

    if (!subInfo) {
      await updateDeploymentStatus(fixId, 'failed', { errorMessage: 'Subscription not found' })
      return { success: false, error: 'Subscription not found' }
    }

    const { subscription, integration } = subInfo
    const token = decrypt(integration.accessToken)

    const logs = await step.run('fetch-logs', async () => {
      return getBuildLogs(deploymentId, subscription.teamId ?? undefined, token)
    })

    await step.run('save-logs', async () => {
      await updateDeploymentStatus(fixId, 'analyzing', { logs })
    })

    const analysis = await step.run('analyze-error', async () => {
      return analyzeBuildLogs(logs)
    })

    const rule = await step.run('find-matching-rule', async () => {
      return findMatchingRule(subscriptionId, analysis)
    })

    if (rule?.skipFix) {
      await updateDeploymentStatus(fixId, 'skipped', {
        errorType: analysis.errorType as ErrorType,
        errorMessage: analysis.errorMessage,
        errorContext: analysis.errorContext,
        matchedRuleId: rule.id,
        completedAt: new Date(),
      })
      return { success: true, action: 'skipped', reason: 'Matched skip rule' }
    }

    await updateDeploymentStatus(fixId, 'analyzing', {
      errorType: analysis.errorType as ErrorType,
      errorMessage: analysis.errorMessage,
      errorContext: analysis.errorContext,
      matchedRuleId: rule?.id,
    })

    const taskPrompt = buildFixPrompt(analysis, subscription.githubRepoFullName, rule?.customPrompt)

    const taskId = await step.run('create-fix-task', async () => {
      const id = nanoid()
      await db.insert(tasks).values({
        id,
        userId: subscription.userId,
        prompt: taskPrompt,
        title: `Fix deployment error: ${analysis.errorType}`,
        repoUrl: `https://github.com/${subscription.githubRepoFullName}`,
        selectedProvider: 'opencode',
        status: 'pending',
      })

      await updateDeploymentStatus(fixId, 'fixing', { taskId: id })

      return id
    })

    return {
      success: true,
      action: 'fixing',
      taskId,
      analysis,
    }
  },
)

function buildFixPrompt(
  analysis: { errorType: string; errorMessage: string; errorContext: string; affectedFiles: string[] },
  repoFullName: string,
  customPrompt?: string | null,
): string {
  if (customPrompt) {
    return `${customPrompt}

## Error Context
Repository: ${repoFullName}
Error Type: ${analysis.errorType}
Error Message: ${analysis.errorMessage}

## Build Logs (excerpt)
\`\`\`
${analysis.errorContext}
\`\`\`

## Affected Files
${analysis.affectedFiles.map((f) => `- ${f}`).join('\n')}`
  }

  return `Fix the following build error in the repository ${repoFullName}.

## Error Type
${analysis.errorType}

## Error Message
${analysis.errorMessage}

## Build Logs (excerpt)
\`\`\`
${analysis.errorContext}
\`\`\`

## Affected Files
${analysis.affectedFiles.map((f) => `- ${f}`).join('\n')}

## Instructions
1. Analyze the error and identify the root cause
2. Make the minimal necessary changes to fix the error
3. Ensure the fix doesn't break any existing functionality
4. Create a pull request with a descriptive title and body explaining the fix`
}
