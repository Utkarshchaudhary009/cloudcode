import 'server-only'

import { Sandbox } from '@vercel/sandbox'
import { db } from '@/lib/db/client'
import { tasks, taskMessages, connectors, deployments, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils/id'
import { createSandbox } from '@/lib/sandbox/creation'
import { executeAgentInSandbox } from '@/lib/sandbox/agents'
import { pushChangesToBranch, shutdownSandbox } from '@/lib/sandbox/git'
import { unregisterSandbox } from '@/lib/sandbox/sandbox-registry'
import { detectPortFromRepo } from '@/lib/sandbox/port-detection'
import { createTaskLogger } from '@/lib/utils/task-logger'
import { generateCommitMessage, createFallbackCommitMessage } from '@/lib/utils/commit-message-generator'
import { decrypt } from '@/lib/crypto'
import { getGitHubTokenByUserId } from '@/lib/github/user-token'
import { getUserApiKeysForUser } from '@/lib/api-keys/user-keys'
import { createPullRequest, parseGitHubUrl } from '@/lib/github/client'
import { getMaxSandboxDuration } from '@/lib/db/settings'

export interface ProcessTaskOptions {
  taskId: string
  userId: string
  prompt: string
  repoUrl: string
  maxDuration?: number
  selectedProvider?: string
  selectedModel?: string
  installDependencies?: boolean
  keepAlive?: boolean
  enableBrowser?: boolean
  branchName?: string
  isDeploymentFix?: boolean
  deploymentId?: string
}

export interface ProcessTaskResult {
  success: boolean
  error?: string
  prCreated?: boolean
  prUrl?: string
  prNumber?: number
}

type ApiKeys = {
  OPENAI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  GOOGLE_API_KEY?: string
  GOOGLE_VERTEX_PROJECT?: string
  GROQ_API_KEY?: string
  CEREBRAS_API_KEY?: string
  OPENROUTER_API_KEY?: string
  HF_TOKEN?: string
  VERCEL_API_KEY?: string
  ZAI_API_KEY?: string
  MINIMAX_API_KEY?: string
  AZURE_OPENAI_API_KEY?: string
  OPENCODE_API_KEY?: string
  COHERE_API_KEY?: string
  DEEPSEEK_API_KEY?: string
  MOONSHOT_API_KEY?: string
  ZHIPU_API_KEY?: string
}

type GitHubUser = {
  username: string
  name: string | null
  email: string | null
}

const getProviderApiKey = (provider: string, apiKeys: ApiKeys | undefined) => {
  if (!apiKeys) return undefined
  switch (provider) {
    case 'openai':
      return apiKeys.OPENAI_API_KEY
    case 'anthropic':
      return apiKeys.ANTHROPIC_API_KEY
    case 'google':
      return apiKeys.GOOGLE_API_KEY
    case 'google-vertex':
      return apiKeys.GOOGLE_VERTEX_PROJECT
    case 'groq':
      return apiKeys.GROQ_API_KEY
    case 'cerebras':
      return apiKeys.CEREBRAS_API_KEY
    case 'openrouter':
      return apiKeys.OPENROUTER_API_KEY
    case 'huggingface':
      return apiKeys.HF_TOKEN
    case 'vercel':
      return apiKeys.VERCEL_API_KEY
    case 'zai':
      return apiKeys.ZAI_API_KEY
    case 'minimax':
      return apiKeys.MINIMAX_API_KEY
    case 'azure':
      return apiKeys.AZURE_OPENAI_API_KEY
    case 'opencode':
      return apiKeys.OPENCODE_API_KEY
    case 'cohere':
      return apiKeys.COHERE_API_KEY
    case 'deepseek':
      return apiKeys.DEEPSEEK_API_KEY
    case 'moonshotai':
      return apiKeys.MOONSHOT_API_KEY
    case 'zhipuai':
      return apiKeys.ZHIPU_API_KEY
    default:
      return undefined
  }
}

async function isTaskStopped(taskId: string): Promise<boolean> {
  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
    return task?.status === 'stopped'
  } catch {
    return false
  }
}

async function waitForBranchName(taskId: string, maxWaitMs: number = 10000): Promise<string | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId))
      if (task?.branchName) {
        return task.branchName
      }
    } catch {
      // Ignore errors
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return null
}

async function getGitHubUserByUserId(userId: string): Promise<GitHubUser | null> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user) return null

    return {
      username: user.username,
      name: user.name,
      email: user.email,
    }
  } catch {
    return null
  }
}

export async function processTaskInternal(options: ProcessTaskOptions): Promise<ProcessTaskResult> {
  const {
    taskId,
    userId,
    prompt,
    repoUrl,
    maxDuration,
    selectedProvider = 'opencode',
    selectedModel,
    installDependencies = false,
    keepAlive = false,
    enableBrowser = false,
    branchName: preGeneratedBranchName,
    isDeploymentFix = false,
    deploymentId,
  } = options

  let sandbox: Sandbox | null = null
  const logger = createTaskLogger(taskId)
  const effectiveMaxDuration = maxDuration || (await getMaxSandboxDuration(userId))
  const TASK_TIMEOUT_MS = effectiveMaxDuration * 60 * 1000

  const warningTimeMs = Math.max(TASK_TIMEOUT_MS - 60 * 1000, 0)
  const warningTimeout = setTimeout(async () => {
    try {
      await logger.info('Task is approaching timeout, will complete soon')
    } catch {
      // Ignore
    }
  }, warningTimeMs)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Task execution timed out'))
    }, TASK_TIMEOUT_MS)
  })

  try {
    await Promise.race([
      processTaskLogic(
        taskId,
        userId,
        prompt,
        repoUrl,
        effectiveMaxDuration,
        selectedProvider,
        selectedModel,
        installDependencies,
        keepAlive,
        enableBrowser,
        preGeneratedBranchName,
        isDeploymentFix,
        deploymentId,
        logger,
        (s) => {
          sandbox = s
        },
      ),
      timeoutPromise,
    ])

    clearTimeout(warningTimeout)

    const [updatedTask] = await db.select().from(tasks).where(eq(tasks.id, taskId))

    return {
      success: updatedTask?.status === 'completed',
      prCreated: !!updatedTask?.prUrl,
      prUrl: updatedTask?.prUrl || undefined,
      prNumber: updatedTask?.prNumber || undefined,
    }
  } catch (error: unknown) {
    clearTimeout(warningTimeout)

    if (error instanceof Error && error.message?.includes('timed out')) {
      await logger.error('Task execution timed out')
      await logger.updateStatus('error', 'Task execution timed out. The operation took too long to complete.')

      if (isDeploymentFix && deploymentId) {
        await updateDeploymentStatus(deploymentId, 'failed', 'Task execution timed out')
      }

      return { success: false, error: 'Task execution timed out' }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    await logger.error('Error occurred during task processing')
    await logger.updateStatus('error', errorMessage)

    if (isDeploymentFix && deploymentId) {
      await updateDeploymentStatus(deploymentId, 'failed', errorMessage)
    }

    return { success: false, error: errorMessage }
  } finally {
    if (sandbox && !keepAlive) {
      try {
        unregisterSandbox(taskId)
        await shutdownSandbox(sandbox)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

async function updateDeploymentStatus(
  deploymentId: string,
  status: 'fixing' | 'pr_created' | 'failed' | 'skipped',
  errorMessage?: string,
  prUrl?: string,
  prNumber?: number,
) {
  try {
    await db
      .update(deployments)
      .set({
        fixStatus: status,
        errorMessage,
        prUrl,
        prNumber,
        updatedAt: new Date(),
        completedAt: status === 'failed' || status === 'pr_created' ? new Date() : undefined,
      })
      .where(eq(deployments.id, deploymentId))
  } catch {
    console.error('Error updating deployment status')
  }
}

async function processTaskLogic(
  taskId: string,
  userId: string,
  prompt: string,
  repoUrl: string,
  maxDuration: number,
  selectedProvider: string,
  selectedModel: string | undefined,
  installDependencies: boolean,
  keepAlive: boolean,
  enableBrowser: boolean,
  preGeneratedBranchName: string | undefined,
  isDeploymentFix: boolean,
  deploymentId: string | undefined,
  logger: ReturnType<typeof createTaskLogger>,
  setSandbox: (s: Sandbox | null) => void,
) {
  console.log('Starting task processing')

  await logger.updateStatus('processing', 'Task created, preparing to start...')
  await logger.updateProgress(10, 'Initializing task execution...')

  try {
    await db.insert(taskMessages).values({
      id: generateId(12),
      taskId,
      role: 'user',
      content: prompt,
    })
  } catch {
    // Ignore errors
  }

  const apiKeys = await getUserApiKeysForUser(userId)
  const githubToken = await getGitHubTokenByUserId(userId)
  const githubUser = await getGitHubUserByUserId(userId)

  if (githubToken) {
    await logger.info('Using authenticated GitHub access')
  }
  await logger.info('API keys configured for selected agent')

  if (await isTaskStopped(taskId)) {
    await logger.info('Task was stopped before execution began')
    return
  }

  const aiBranchName = preGeneratedBranchName || (await waitForBranchName(taskId, 10000))

  if (await isTaskStopped(taskId)) {
    await logger.info('Task was stopped during branch name generation')
    return
  }

  if (aiBranchName) {
    await logger.info('Using AI-generated branch name')
  } else {
    await logger.info('AI branch name not ready, will use fallback during sandbox creation')
  }

  await logger.updateProgress(15, 'Creating sandbox environment')
  console.log('Creating sandbox')

  const port = await detectPortFromRepo(repoUrl, githubToken)
  console.log(`Detected port ${port} for project`)

  const sandboxResult = await createSandbox(
    {
      taskId,
      repoUrl,
      githubToken,
      gitAuthorName: githubUser?.name || githubUser?.username || 'OpenCode',
      gitAuthorEmail: githubUser?.username ? `${githubUser.username}@users.noreply.github.com` : 'opencode@example.com',
      apiKeys,
      timeout: `${maxDuration}m`,
      ports: [port],
      runtime: 'node22',
      resources: { vcpus: 4 },
      taskPrompt: prompt,
      selectedProvider,
      selectedModel,
      installDependencies,
      keepAlive,
      enableBrowser,
      preDeterminedBranchName: aiBranchName || undefined,
      onProgress: async (progress: number, message: string) => {
        await logger.updateProgress(progress, message)
      },
      onCancellationCheck: async () => {
        return await isTaskStopped(taskId)
      },
    },
    logger,
  )

  if (!sandboxResult.success) {
    if (sandboxResult.cancelled) {
      await logger.info('Task was cancelled during sandbox creation')
      return
    }
    throw new Error(sandboxResult.error || 'Failed to create sandbox')
  }

  if (await isTaskStopped(taskId)) {
    await logger.info('Task was stopped during sandbox creation')
    if (sandboxResult.sandbox) {
      try {
        await shutdownSandbox(sandboxResult.sandbox)
      } catch {
        // Ignore
      }
    }
    return
  }

  const { sandbox: createdSandbox, domain, branchName } = sandboxResult
  const sandbox = createdSandbox || null
  setSandbox(sandbox)
  console.log('Sandbox created successfully')

  const updateData: { sandboxUrl?: string; sandboxId?: string; updatedAt: Date; branchName?: string } = {
    sandboxId: sandbox?.sandboxId || undefined,
    sandboxUrl: domain || undefined,
    updatedAt: new Date(),
  }

  if (!aiBranchName) {
    updateData.branchName = branchName
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId))

  if (await isTaskStopped(taskId)) {
    await logger.info('Task was stopped before agent execution')
    return
  }

  await logger.updateProgress(50, 'Installing and executing agent')
  console.log('Starting agent execution')

  if (!sandbox) {
    throw new Error('Sandbox is not available for agent execution')
  }

  type Connector = typeof connectors.$inferSelect
  let mcpServers: Connector[] = []

  try {
    const userConnectors = await db
      .select()
      .from(connectors)
      .where(and(eq(connectors.userId, userId), eq(connectors.status, 'connected')))

    mcpServers = userConnectors.map((connector: Connector) => {
      const decryptedEnv = connector.env ? JSON.parse(decrypt(connector.env)) : null
      return {
        ...connector,
        env: decryptedEnv,
        oauthClientSecret: connector.oauthClientSecret ? decrypt(connector.oauthClientSecret) : null,
      }
    })

    if (mcpServers.length > 0) {
      await logger.info('Found connected MCP servers')

      await db
        .update(tasks)
        .set({
          mcpServerIds: JSON.parse(JSON.stringify(mcpServers.map((s) => s.id))),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId))
    } else {
      await logger.info('No connected MCP servers found for current user')
    }
  } catch {
    await logger.info('Warning: Could not fetch MCP servers, continuing without them')
  }

  const sanitizedPrompt = prompt.replace(/`/g, "'").replace(/\$/g, '').replace(/\\/g, '').replace(/^-/gm, ' -')

  const agentMessageId = generateId()

  const agentResult = await executeAgentInSandbox(
    sandbox,
    sanitizedPrompt,
    logger,
    selectedModel,
    mcpServers,
    undefined,
    apiKeys,
    undefined,
    undefined,
    taskId,
    agentMessageId,
  )

  console.log('Agent execution completed')

  if (agentResult.opencodeSessionId) {
    await db.update(tasks).set({ opencodeSessionId: agentResult.opencodeSessionId }).where(eq(tasks.id, taskId))
  }

  if (agentResult.success) {
    await logger.success('Agent execution completed')
    await logger.info('Code changes applied successfully')

    if (agentResult.agentResponse) {
      await logger.info('Agent response received')

      try {
        await db.insert(taskMessages).values({
          id: generateId(12),
          taskId,
          role: 'agent',
          content: agentResult.agentResponse,
        })
      } catch {
        // Ignore
      }
    }

    let commitMessage: string
    try {
      let repoName: string | undefined
      try {
        const url = new URL(repoUrl)
        const pathParts = url.pathname.split('/')
        if (pathParts.length >= 3) {
          repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '')
        }
      } catch {
        // Ignore
      }

      const providerApiKey = getProviderApiKey(selectedProvider, apiKeys)

      if (providerApiKey || process.env.AI_GATEWAY_API_KEY) {
        commitMessage = await generateCommitMessage({
          description: prompt,
          repoName,
          context: `${selectedProvider} provider task`,
          provider: selectedProvider as any,
          apiKey: providerApiKey,
          modelId: selectedModel,
        })
      } else {
        commitMessage = createFallbackCommitMessage(prompt)
      }
    } catch {
      commitMessage = createFallbackCommitMessage(prompt)
    }

    const pushResult = await pushChangesToBranch(sandbox!, branchName!, commitMessage, logger)

    if (keepAlive) {
      await logger.info('Sandbox kept alive for follow-up messages')
    } else {
      unregisterSandbox(taskId)
      const shutdownResult = await shutdownSandbox(sandbox!)
      if (shutdownResult.success) {
        await logger.success('Sandbox shutdown completed')
      } else {
        await logger.error('Sandbox shutdown failed')
      }
    }

    if (pushResult.pushFailed) {
      await logger.updateStatus('error')
      await logger.error('Task failed: Unable to push changes to repository')
      throw new Error('Failed to push changes to repository')
    }

    if (isDeploymentFix && branchName) {
      const parsed = parseGitHubUrl(repoUrl)
      if (parsed) {
        await logger.info('Creating pull request for deployment fix')

        const prTitle = `Fix deployment error`
        const prBody = `## Automated Deployment Fix

This PR was automatically generated to fix a deployment error.

### Changes Made
The AI agent analyzed the deployment error and applied fixes to resolve the issue.`

        const prResult = await createPullRequest({
          repoUrl,
          branchName,
          title: prTitle,
          body: prBody,
          baseBranch: 'main',
        })

        if (prResult.success && prResult.prUrl) {
          await logger.info('Pull request created successfully')

          await db
            .update(tasks)
            .set({
              prUrl: prResult.prUrl,
              prNumber: prResult.prNumber,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, taskId))

          if (deploymentId) {
            await updateDeploymentStatus(deploymentId, 'pr_created', undefined, prResult.prUrl, prResult.prNumber)
          }

          await logger.updateStatus('completed')
          await logger.updateProgress(100, 'Task completed successfully - PR created')
          console.log('Task completed successfully with PR')

          return
        } else {
          await logger.error('Failed to create pull request for deployment fix')

          if (deploymentId) {
            await updateDeploymentStatus(deploymentId, 'failed', prResult.error || 'Failed to create pull request')
          }
        }
      }
    }

    await logger.updateStatus('completed')
    await logger.updateProgress(100, 'Task completed successfully')
    console.log('Task completed successfully')
  } else {
    await logger.error('Agent execution failed')

    throw new Error(agentResult.error || 'Agent execution failed')
  }
}
