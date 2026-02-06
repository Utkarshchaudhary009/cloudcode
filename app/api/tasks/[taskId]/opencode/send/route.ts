import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getAuthorizedTask } from '@/lib/opencode/task-session.server'
import { getOpencodeClient, unwrapOpencodeResponse } from '@/lib/opencode/client.server'

const parseCommand = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const body = trimmed.slice(1).trim()
  if (!body) return null
  const [command, ...rest] = body.split(/\s+/)
  return { command, args: rest.join(' ') }
}

export async function POST(req: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const session = await getServerSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { taskId } = await context.params
  const task = await getAuthorizedTask(taskId, session.user.id)

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { input } = (await req.json()) as { input?: string }
  const trimmedInput = input?.trim()

  if (!trimmedInput) {
    return NextResponse.json({ error: 'Input is required' }, { status: 400 })
  }

  const client = getOpencodeClient()
  const sessionId = task.agentSessionId

  if (!client || !sessionId) {
    return NextResponse.json({ available: false }, { status: 400 })
  }

  try {
    const command = parseCommand(trimmedInput)
    if (command) {
      await client.session.command({
        path: { id: sessionId },
        body: {
          command: command.command,
          arguments: command.args,
        },
      })

      return NextResponse.json({ available: true, mode: 'command', queued: false })
    }

    const statusResponse = await client.session.status()
    const statusMap = unwrapOpencodeResponse<Record<string, { type: string }>>(statusResponse)
    const status = statusMap?.[sessionId]
    const isBusy = status?.type === 'busy' || status?.type === 'retry'

    if (isBusy) {
      await client.session.promptAsync({
        path: { id: sessionId },
        body: {
          parts: [{ type: 'text', text: trimmedInput }],
        },
      })

      return NextResponse.json({ available: true, mode: 'prompt_async', queued: true })
    }

    await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: trimmedInput }],
      },
    })

    return NextResponse.json({ available: true, mode: 'prompt', queued: false })
  } catch {
    return NextResponse.json({ error: 'Failed to send session input' }, { status: 500 })
  }
}
