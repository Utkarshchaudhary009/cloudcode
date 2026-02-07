import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { githubInstallations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const existing = await db.select().from(githubInstallations).where(eq(githubInstallations.id, id)).limit(1)

  if (!existing[0]) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 })
  }

  if (existing[0].userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.delete(githubInstallations).where(eq(githubInstallations.id, id))

  return NextResponse.json({ success: true })
}
