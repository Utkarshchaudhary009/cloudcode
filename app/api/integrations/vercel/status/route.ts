import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/integrations/connection-manager'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getConnection(session.user.id, 'vercel')

  return NextResponse.json({
    id: connection?.id,
    connected: !!connection,
    provider: 'vercel',
    username: connection?.username,
    connectedAt: connection?.createdAt,
    teamId: connection?.teamId,
    teamSlug: connection?.teamSlug,
  })
}
