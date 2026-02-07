import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { scheduledTasks } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { searchParams } = new URL(request.url)
  const enabledOnly = searchParams.get('enabled') === 'true'

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      enabledOnly
        ? and(eq(scheduledTasks.userId, user.id), eq(scheduledTasks.enabled, true))
        : eq(scheduledTasks.userId, user.id),
    )
    .orderBy(desc(scheduledTasks.createdAt))

  return NextResponse.json({ tasks })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const body = await request.json()

  const task = await db
    .insert(scheduledTasks)
    .values({
      id: nanoid(),
      userId: user.id,
      name: body.name,
      repoUrl: body.repoUrl,
      prompt: body.prompt,
      taskType: body.taskType,
      timeSlot: body.timeSlot,
      days: body.days || ['daily'],
      timezone: body.timezone || 'UTC',
      selectedAgent: body.selectedAgent,
      selectedModel: body.selectedModel,
      enabled: body.enabled ?? true,
    })
    .returning()

  return NextResponse.json({ task: task[0] })
}
