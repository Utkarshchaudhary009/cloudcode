import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { tasks, taskMessages } from '@/lib/db/schema'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { getUserApiKeys } from '@/lib/api-keys/user-keys'
import { generatePRDescription } from '@/lib/utils/description-generator'
import { type OpenCodeProviderId } from '@/lib/opencode/providers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params

    // Get the task
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
      .limit(1)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get task messages to provide context of changes
    const messages = await db
      .select()
      .from(taskMessages)
      .where(eq(taskMessages.taskId, taskId))
      .orderBy(asc(taskMessages.createdAt))

    const agentResponse = messages
      .filter((m) => m.role === 'agent')
      .map((m) => m.content)
      .join('\n\n')

    // Get user API keys
    const userApiKeys = await getUserApiKeys()
    
    // Helper to get specific API key
    const getProviderApiKey = (provider: string) => {
      switch (provider) {
        case 'openai': return userApiKeys.OPENAI_API_KEY;
        case 'anthropic': return userApiKeys.ANTHROPIC_API_KEY;
        case 'google': return userApiKeys.GOOGLE_API_KEY;
        case 'google-vertex': return userApiKeys.GOOGLE_VERTEX_PROJECT;
        case 'groq': return userApiKeys.GROQ_API_KEY;
        case 'cerebras': return userApiKeys.CEREBRAS_API_KEY;
        case 'openrouter': return userApiKeys.OPENROUTER_API_KEY;
        case 'huggingface': return userApiKeys.HF_TOKEN;
        case 'vercel': return userApiKeys.VERCEL_API_KEY;
        case 'zai': return userApiKeys.ZAI_API_KEY;
        case 'minimax': return userApiKeys.MINIMAX_API_KEY;
        case 'azure': return userApiKeys.AZURE_OPENAI_API_KEY;
        case 'opencode': return userApiKeys.OPENCODE_API_KEY;
        case 'cohere': return userApiKeys.COHERE_API_KEY;
        case 'deepseek': return userApiKeys.DEEPSEEK_API_KEY;
        case 'moonshotai': return userApiKeys.MOONSHOT_API_KEY;
        case 'zhipuai': return userApiKeys.ZHIPU_API_KEY;
        default: return undefined;
      }
    }

    const providerId = (task.selectedProvider as OpenCodeProviderId) || 'openai'
    const apiKey = getProviderApiKey(providerId)

    // Generate PR description
    const description = await generatePRDescription({
      prompt: task.prompt,
      repoName: task.repoUrl?.split('/').pop()?.replace('.git', ''),
      context: `${providerId} task execution`,
      provider: providerId,
      apiKey,
      modelId: task.selectedModel || undefined,
      changes: agentResponse,
    })

    return NextResponse.json({ description })
  } catch (error) {
    console.error('Error generating PR description:', error)
    return NextResponse.json({ error: 'Failed to generate PR description' }, { status: 500 })
  }
}
