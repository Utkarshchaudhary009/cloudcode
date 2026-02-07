import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { reviews } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { id } = await params

  const review = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1)

  if (!review[0]) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  if (review[0].userId !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ review: review[0] })
}
