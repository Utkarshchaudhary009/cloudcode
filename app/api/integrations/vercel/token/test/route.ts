import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { decrypt } from '@/lib/crypto'
import { providers } from '@/lib/integrations/registry'

export async function POST() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ints = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, session.user.id), eq(integrations.provider, 'vercel')))

  const integration = ints[0]

  if (!integration) {
    return NextResponse.json({ valid: false, error: 'No Vercel integration found' })
  }

  try {
    const token = decrypt(integration.accessToken)
    const provider = providers.vercel

    if (!provider) {
      return NextResponse.json({ valid: false, error: 'Provider not found' })
    }

    const userInfo = await provider.validateToken(token)

    return NextResponse.json({
      valid: true,
      username: userInfo.username,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Token is invalid or expired' })
  }
}
