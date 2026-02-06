import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getAuthorizedTask } from '@/lib/opencode/task-session.server'
import { getOpencodeClient, unwrapOpencodeResponse } from '@/lib/opencode/client.server'

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
    return NextResponse.json({ available: false, diffs: [] })
  }

  try {
    const response = await client.session.diff({ path: { id: sessionId } })
    const data =
      unwrapOpencodeResponse<
        Array<{ file: string; additions: number; deletions: number; before: string; after: string }>
      >(response)

    return NextResponse.json({ available: true, diffs: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch session diff' }, { status: 500 })
  }
}
