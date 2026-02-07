import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { reviewRules } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
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

  const rules = await db
    .select()
    .from(reviewRules)
    .where(
      enabledOnly
        ? and(eq(reviewRules.userId, user.id), eq(reviewRules.enabled, true))
        : eq(reviewRules.userId, user.id),
    )
    .orderBy(desc(reviewRules.createdAt))

  return NextResponse.json({ rules })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user

  const body = await request.json()

  const rule = await db
    .insert(reviewRules)
    .values({
      id: nanoid(),
      userId: user.id,
      name: body.name,
      description: body.description,
      prompt: body.prompt,
      severity: body.severity || 'warning',
      repoUrl: body.repoUrl,
      filePatterns: body.filePatterns,
      enabled: body.enabled ?? true,
    })
    .returning()

  return NextResponse.json({ rule: rule[0] })
}
