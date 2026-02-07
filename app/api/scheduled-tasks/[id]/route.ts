import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { scheduledTasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params

  const task = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).limit(1)

  if (!task[0]) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (task[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ task: task[0] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params
  const body = await request.json()

  const existing = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).limit(1)

  if (!existing[0]) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const task = await db
    .update(scheduledTasks)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, id))
    .returning()

  return NextResponse.json({ task: task[0] })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params

  const existing = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).limit(1)

  if (!existing[0]) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id))

  return NextResponse.json({ success: true })
}
