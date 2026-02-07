import { inngest } from '../../client'
import { db } from '@/lib/db/client'
import { vercelSubscriptions, buildFixes, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Sandbox } from '@vercel/sandbox'
import { createSandbox } from '@/lib/sandbox/creation'
import { createTaskLogger } from '@/lib/utils/task-logger'
import { executeAgentInSandbox, AgentType } from '@/lib/sandbox/agents'
import { pushChangesToBranch, shutdownSandbox } from '@/lib/sandbox/git'
import { unregisterSandbox } from '@/lib/sandbox/sandbox-registry'
import { decrypt } from '@/lib/crypto'
import { getUserApiKeysForUser } from '@/lib/api-keys/user-keys'
import { detectPortFromRepo } from '@/lib/sandbox/port-detection'

// Handles deployment failure - creates build fix record and triggers fix execution
export const handleDeploymentFailed = inngest.createFunction(
  { id: 'handle-vercel-deployment-failed', name: 'Handle Vercel Deployment Failed' },
  { event: 'vercel/deployment.failed' },
  async ({ event, step }: { event: any; step: any }) => {
    const { subscriptionId, deploymentId, branch, buildError, projectName } = event.data

    // Get subscription details
    const subscription = await step.run('get-subscription', async () => {
      const [sub] = await db
        .select()
        .from(vercelSubscriptions)
        .where(eq(vercelSubscriptions.id, subscriptionId))
        .limit(1)
      return sub
    })

    if (!subscription || !subscription.enabled) {
      return { message: 'Subscription not found or disabled' }
    }

    // Get or create build fix record
    const buildFix = await step.run('get-build-fix', async () => {
      const [existing] = await db.select().from(buildFixes).where(eq(buildFixes.deploymentId, deploymentId)).limit(1)

      if (existing) {
        return existing
      }

      // This shouldn't happen as webhook creates it, but just in case
      return null
    })

    if (!buildFix) {
      return { message: 'Build fix record not found' }
    }

    // Check if we've exhausted attempts
    if (buildFix.attempts >= subscription.maxAttempts) {
      await step.run('mark-exhausted', async () => {
        await db
          .update(buildFixes)
          .set({
            status: 'exhausted',
            updatedAt: new Date(),
          })
          .where(eq(buildFixes.id, buildFix.id))
      })
      return { message: 'Max attempts reached', attempts: buildFix.attempts }
    }

    // Trigger the actual fix execution
    await step.sendEvent('trigger-fix', {
      name: 'vercel/build-fix.execute',
      data: {
        buildFixId: buildFix.id,
        subscriptionId: subscription.id,
        attempt: buildFix.attempts + 1,
      },
    })

    return { message: 'Fix execution triggered', attempt: buildFix.attempts + 1 }
  },
)

// Actually executes the fix using AI agent
export const executeBuildFix = inngest.createFunction(
  {
    id: 'execute-vercel-build-fix',
    name: 'Execute Vercel Build Fix',
    retries: 0, // Don't retry automatically, we handle retries ourselves
  },
  { event: 'vercel/build-fix.execute' },
  async ({ event, step }: { event: any; step: any }) => {
    const { buildFixId, subscriptionId, attempt } = event.data

    let sandbox: Sandbox | null = null

    try {
      // Get build fix and subscription
      const [buildFix] = await step.run('get-build-fix', async () => {
        return await db.select().from(buildFixes).where(eq(buildFixes.id, buildFixId)).limit(1)
      })

      if (!buildFix) {
        return { error: 'Build fix not found' }
      }

      const [subscription] = await step.run('get-subscription', async () => {
        return await db.select().from(vercelSubscriptions).where(eq(vercelSubscriptions.id, subscriptionId)).limit(1)
      })

      if (!subscription) {
        return { error: 'Subscription not found' }
      }

      // Get user details
      const [user] = await step.run('get-user', async () => {
        return await db.select().from(users).where(eq(users.id, subscription.userId)).limit(1)
      })

      if (!user) {
        return { error: 'User not found' }
      }

      // Update status to fixing
      await step.run('update-status-fixing', async () => {
        await db
          .update(buildFixes)
          .set({
            status: 'fixing',
            attempts: attempt,
            updatedAt: new Date(),
          })
          .where(eq(buildFixes.id, buildFixId))
      })

      // Execute the fix
      const fixResult = await step.run('execute-fix', async () => {
        const repoUrl = subscription.repoUrl
        if (!repoUrl) {
          throw new Error('No repository URL configured for this subscription')
        }

        // Create a pseudo task logger
        const logger = createTaskLogger(`buildfix-${buildFixId}`)

        // Get user's github token (decrypted)
        let githubToken: string | null = null
        try {
          const decryptedToken = decrypt(user.accessToken)
          if (user.provider === 'github') {
            githubToken = decryptedToken
          }
        } catch {
          console.error('Failed to decrypt user token')
        }

        // Get user API keys
        const apiKeys = await getUserApiKeysForUser(subscription.userId)

        // Detect port
        const port = await detectPortFromRepo(repoUrl, githubToken)

        // Create sandbox
        const sandboxResult = await createSandbox(
          {
            taskId: `buildfix-${buildFixId}`,
            repoUrl,
            githubToken,
            gitAuthorName: user.name || user.username,
            gitAuthorEmail: user.email || `${user.username}@users.noreply.github.com`,
            apiKeys,
            timeout: '10m',
            ports: [port],
            runtime: 'node22',
            resources: { vcpus: 4 },
            taskPrompt: `Fix the build error on branch ${buildFix.branch}`,
            selectedAgent: subscription.selectedAgent || 'openai',
            selectedModel: subscription.selectedModel || undefined,
            installDependencies: true,
            preDeterminedBranchName: buildFix.branch,
            onProgress: async (progress: number, message: string) => {
              await logger.updateProgress(progress, message)
            },
          },
          logger,
        )

        if (!sandboxResult.success || !sandboxResult.sandbox) {
          throw new Error(sandboxResult.error || 'Failed to create sandbox')
        }

        sandbox = sandboxResult.sandbox

        // Build the prompt for the AI agent
        const fixPrompt = `
There is a Vercel build failure on branch "${buildFix.branch}".

${buildFix.buildError ? `Build error logs:\n\`\`\`\n${buildFix.buildError}\n\`\`\`` : 'The build failed. Please check for TypeScript errors, missing imports, or other issues.'}

Please:
1. Identify and fix the build error
2. Make minimal changes needed to fix the issue
3. Ensure the code compiles without errors

Focus on fixing the root cause, not just the symptoms.
`

        // Execute the AI agent
        const agentResult = await executeAgentInSandbox(
          sandbox,
          fixPrompt,
          'opencode' as AgentType,
          logger,
          subscription.selectedModel || undefined,
          undefined, // No MCP servers
          undefined, // No cancellation check
          apiKeys,
          false, // Not resumed
          undefined, // No session ID
          `buildfix-${buildFixId}`,
        )

        if (!agentResult.success) {
          throw new Error(agentResult.error || 'Agent execution failed')
        }

        // Push changes directly to branch (no PR)
        const commitMessage = `fix: Auto-fix build error (attempt ${attempt})\n\nAutomatically generated fix for Vercel build failure.`
        const pushResult = await pushChangesToBranch(sandbox, buildFix.branch, commitMessage, logger)

        // Cleanup
        unregisterSandbox(`buildfix-${buildFixId}`)
        await shutdownSandbox(sandbox)
        sandbox = null

        return {
          success: !pushResult.pushFailed,
          commitSha: pushResult.pushFailed ? null : 'pushed',
        }
      })

      if (fixResult.success) {
        // Mark as pending while waiting for new deployment
        await step.run('update-status-pending-deploy', async () => {
          await db
            .update(buildFixes)
            .set({
              status: 'fixing', // Keep as fixing until deployment succeeds
              lastFixCommit: fixResult.commitSha,
              updatedAt: new Date(),
            })
            .where(eq(buildFixes.id, buildFixId))
        })

        return { success: true, message: 'Fix pushed, waiting for deployment' }
      } else {
        throw new Error('Failed to push fix')
      }
    } catch (error) {
      // Cleanup sandbox if exists
      if (sandbox) {
        try {
          unregisterSandbox(`buildfix-${buildFixId}`)
          await shutdownSandbox(sandbox)
        } catch {
          console.error('Failed to cleanup sandbox')
        }
      }

      // Mark as failed
      await step.run('update-status-failed', async () => {
        const [buildFix] = await db.select().from(buildFixes).where(eq(buildFixes.id, buildFixId)).limit(1)

        const [subscription] = await db
          .select()
          .from(vercelSubscriptions)
          .where(eq(vercelSubscriptions.id, subscriptionId))
          .limit(1)

        const newStatus =
          buildFix && subscription && buildFix.attempts >= subscription.maxAttempts ? 'exhausted' : 'failed'

        await db
          .update(buildFixes)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(buildFixes.id, buildFixId))
      })

      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },
)
