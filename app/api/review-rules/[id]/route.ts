import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { reviewRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params

  const rule = await db.select().from(reviewRules).where(eq(reviewRules.id, id)).limit(1)

  if (!rule[0]) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (rule[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ rule: rule[0] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params
  const body = await request.json()

  const existing = await db.select().from(reviewRules).where(eq(reviewRules.id, id)).limit(1)

  if (!existing[0]) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rule = await db
    .update(reviewRules)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(reviewRules.id, id))
    .returning()

  return NextResponse.json({ rule: rule[0] })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params

  const existing = await db.select().from(reviewRules).where(eq(reviewRules.id, id)).limit(1)

  if (!existing[0]) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.delete(reviewRules).where(eq(reviewRules.id, id))

  return NextResponse.json({ success: true })
}
