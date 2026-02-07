import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { reviews } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const repoUrl = searchParams.get('repoUrl')

  const conditions = [eq(reviews.userId, user.id)]

  if (status) {
    conditions.push(eq(reviews.status, status as any))
  }

  if (repoUrl) {
    conditions.push(eq(reviews.repoUrl, repoUrl))
  }

  const reviewsData = await db
    .select()
    .from(reviews)
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt))

  return NextResponse.json({ reviews: reviewsData })
}
