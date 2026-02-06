import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getAuthorizedTask } from '@/lib/opencode/task-session.server'
import { getOpencodeClient, unwrapOpencodeResponse } from '@/lib/opencode/client.server'

const extractText = (parts: Array<{ type?: string; text?: string }>) => {
  return parts
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n')
}

export async function GET(_: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await getServerSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { taskId } = await context.params
  const task = await getAuthorizedTask(taskId, session.user.id)

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const client = getOpencodeClient()
  const sessionId = task.agentSessionId

  if (!client || !sessionId) {
    return NextResponse.json({ available: false, messages: [] })
  }

  try {
    const response = await client.session.messages({ path: { id: sessionId } })
    const data = unwrapOpencodeResponse<
      Array<{
        info: { id: string; role: string; time: { created: number } }
        parts: Array<{ type?: string; text?: string }>
      }>
    >(response)

    const messages = (data || []).map((entry) => ({
      id: entry.info.id,
      role: entry.info.role,
      createdAt: entry.info.time.created,
      text: extractText(entry.parts),
    }))

    return NextResponse.json({ available: true, messages })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 })
  }
}
