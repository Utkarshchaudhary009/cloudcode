import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db/client'
import { tasks, insertTaskSchema, taskMessages, type Task } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/id'
import { eq, desc, or, and, isNull } from 'drizzle-orm'
import { createTaskLogger } from '@/lib/utils/task-logger'
import { generateBranchName, createFallbackBranchName } from '@/lib/utils/branch-name-generator'
import { generateTaskTitle, createFallbackTitle } from '@/lib/utils/title-generator'
import { getUserApiKeys } from '@/lib/api-keys/user-keys'
import { getUserGitHubToken } from '@/lib/github/user-token'
import { getGitHubUser } from '@/lib/github/client'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { getMaxSandboxDuration } from '@/lib/db/settings'
import { processTaskInternal } from '@/lib/tasks/processor'
import { ZodError } from 'zod'
import { getServerSession } from '@/lib/session/get-server-session'

export const maxDuration = 60

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .orderBy(desc(tasks.createdAt))

    return NextResponse.json({ tasks: userTasks })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(session.user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `You have reached the daily limit of ${rateLimit.total} messages (tasks + follow-ups). Your limit will reset at ${rateLimit.resetAt.toISOString()}`,
          remaining: rateLimit.remaining,
          total: rateLimit.total,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 },
      )
    }

    const body = await request.json()

    const taskId = body.id || generateId(12)
    const validatedData = insertTaskSchema.parse({
      ...body,
      id: taskId,
      userId: session.user.id,
      status: 'pending',
      progress: 0,
      logs: [],
    })

    const [newTask] = await db
      .insert(tasks)
      .values({
        ...validatedData,
        id: taskId,
      })
      .returning()

    const userApiKeys = await getUserApiKeys()
    const userGithubToken = await getUserGitHubToken()
    const githubUser = await getGitHubUser()

    const getProviderApiKey = (provider: string) => {
      switch (provider) {
        case 'openai':
          return userApiKeys.OPENAI_API_KEY
        case 'anthropic':
          return userApiKeys.ANTHROPIC_API_KEY
        case 'google':
          return userApiKeys.GOOGLE_API_KEY
        case 'google-vertex':
          return userApiKeys.GOOGLE_VERTEX_PROJECT
        case 'groq':
          return userApiKeys.GROQ_API_KEY
        case 'cerebras':
          return userApiKeys.CEREBRAS_API_KEY
        case 'openrouter':
          return userApiKeys.OPENROUTER_API_KEY
        case 'huggingface':
          return userApiKeys.HF_TOKEN
        case 'vercel':
          return userApiKeys.VERCEL_API_KEY
        case 'zai':
          return userApiKeys.ZAI_API_KEY
        case 'minimax':
          return userApiKeys.MINIMAX_API_KEY
        case 'azure':
          return userApiKeys.AZURE_OPENAI_API_KEY
        case 'opencode':
          return userApiKeys.OPENCODE_API_KEY
        case 'cohere':
          return userApiKeys.COHERE_API_KEY
        case 'deepseek':
          return userApiKeys.DEEPSEEK_API_KEY
        case 'moonshotai':
          return userApiKeys.MOONSHOT_API_KEY
        case 'zhipuai':
          return userApiKeys.ZHIPU_API_KEY
        default:
          return undefined
      }
    }

    const providerApiKey = getProviderApiKey(validatedData.selectedProvider || 'opencode')

    after(async () => {
      try {
        if (!providerApiKey && !process.env.AI_GATEWAY_API_KEY) {
          console.log('No API key available, skipping AI branch name generation')
          return
        }

        const logger = createTaskLogger(taskId)
        await logger.info('Generating AI-powered branch name...')

        let repoName: string | undefined
        try {
          const url = new URL(validatedData.repoUrl || '')
          const pathParts = url.pathname.split('/')
          if (pathParts.length >= 3) {
            repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '')
          }
        } catch {
          // Ignore URL parsing errors
        }

        const aiBranchName = await generateBranchName({
          description: validatedData.prompt,
          repoName,
          context: `${validatedData.selectedProvider} provider task`,
          provider: validatedData.selectedProvider as any,
          apiKey: providerApiKey,
          modelId: validatedData.selectedModel,
        })

        await db
          .update(tasks)
          .set({
            branchName: aiBranchName,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))

        await logger.success('Generated AI branch name')
      } catch (error) {
        console.error('Error generating AI branch name:', error)

        const fallbackBranchName = createFallbackBranchName(taskId)

        try {
          await db
            .update(tasks)
            .set({
              branchName: fallbackBranchName,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, taskId))

          const logger = createTaskLogger(taskId)
          await logger.info('Using fallback branch name')
        } catch (dbError) {
          console.error('Error updating task with fallback branch name:', dbError)
        }
      }
    })

    after(async () => {
      try {
        if (!providerApiKey && !process.env.AI_GATEWAY_API_KEY) {
          console.log('No API key available, skipping AI title generation')
          return
        }

        let repoName: string | undefined
        try {
          const url = new URL(validatedData.repoUrl || '')
          const pathParts = url.pathname.split('/')
          if (pathParts.length >= 3) {
            repoName = pathParts[pathParts.length - 1].replace(/\.git$/, '')
          }
        } catch {
          // Ignore URL parsing errors
        }

        const aiTitle = await generateTaskTitle({
          prompt: validatedData.prompt,
          repoName,
          context: `${validatedData.selectedProvider} provider task`,
          provider: validatedData.selectedProvider as any,
          apiKey: providerApiKey,
          modelId: validatedData.selectedModel,
        })

        await db
          .update(tasks)
          .set({
            title: aiTitle,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))
      } catch (error) {
        console.error('Error generating AI title:', error)

        const fallbackTitle = createFallbackTitle(validatedData.prompt)

        try {
          await db
            .update(tasks)
            .set({
              title: fallbackTitle,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, taskId))
        } catch (dbError) {
          console.error('Error updating task with fallback title:', dbError)
        }
      }
    })

    const maxSandboxDuration = await getMaxSandboxDuration(session.user.id)

    after(async () => {
      try {
        await processTaskInternal({
          taskId: newTask.id,
          userId: session.user.id,
          prompt: validatedData.prompt,
          repoUrl: validatedData.repoUrl || '',
          maxDuration: validatedData.maxDuration || maxSandboxDuration,
          selectedProvider: validatedData.selectedProvider || 'opencode',
          selectedModel: validatedData.selectedModel,
          installDependencies: validatedData.installDependencies || false,
          keepAlive: validatedData.keepAlive || false,
          enableBrowser: validatedData.enableBrowser || false,
        })
      } catch (error) {
        console.error('Task processing failed:', error)
      }
    })

    return NextResponse.json({ task: newTask })
  } catch (error) {
    console.error('Error creating task:', error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
          message: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 },
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create task', message: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (!action) {
      return NextResponse.json({ error: 'Action parameter is required' }, { status: 400 })
    }

    const actions = action.split(',').map((a) => a.trim())
    const validActions = ['completed', 'failed', 'stopped']
    const invalidActions = actions.filter((a) => !validActions.includes(a))

    if (invalidActions.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid action(s): ${invalidActions.join(', ')}. Valid actions: ${validActions.join(', ')}`,
        },
        { status: 400 },
      )
    }

    const statusConditions = []
    if (actions.includes('completed')) {
      statusConditions.push(eq(tasks.status, 'completed'))
    }
    if (actions.includes('failed')) {
      statusConditions.push(eq(tasks.status, 'error'))
    }
    if (actions.includes('stopped')) {
      statusConditions.push(eq(tasks.status, 'stopped'))
    }

    if (statusConditions.length === 0) {
      return NextResponse.json({ error: 'No valid actions specified' }, { status: 400 })
    }

    const statusClause = statusConditions.length === 1 ? statusConditions[0] : or(...statusConditions)
    const whereClause = and(statusClause, eq(tasks.userId, session.user.id))
    const deletedTasks = await db.delete(tasks).where(whereClause).returning()

    const actionMessages = []
    if (actions.includes('completed')) {
      const completedCount = deletedTasks.filter((task: Task) => task.status === 'completed').length
      if (completedCount > 0) actionMessages.push(`${completedCount} completed`)
    }
    if (actions.includes('failed')) {
      const failedCount = deletedTasks.filter((task: Task) => task.status === 'error').length
      if (failedCount > 0) actionMessages.push(`${failedCount} failed`)
    }
    if (actions.includes('stopped')) {
      const stoppedCount = deletedTasks.filter((task: Task) => task.status === 'stopped').length
      if (stoppedCount > 0) actionMessages.push(`${stoppedCount} stopped`)
    }

    const message =
      actionMessages.length > 0
        ? `${actionMessages.join(' and ')} task(s) deleted successfully`
        : 'No tasks found to delete'

    return NextResponse.json({
      message,
      deletedCount: deletedTasks.length,
    })
  } catch (error) {
    console.error('Error deleting tasks:', error)
    return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 })
  }
}
