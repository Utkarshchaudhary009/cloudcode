import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { githubInstallations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const installations = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.userId, session.user.id))

  return NextResponse.json({ installations })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const installation = await db
    .insert(githubInstallations)
    .values({
      id: nanoid(),
      userId: session.user.id,
      installationId: body.installationId,
      repoUrl: body.repoUrl,
      autoReviewEnabled: body.autoReviewEnabled ?? true,
      reviewOnDraft: body.reviewOnDraft ?? false,
    })
    .returning()

  return NextResponse.json({ installation: installation[0] })
}
