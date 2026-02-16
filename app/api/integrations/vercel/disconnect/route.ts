import { NextResponse } from 'next/server'
import { disconnect } from '@/lib/integrations/connection-manager'
import { getServerSession } from '@/lib/session/get-server-session'

export async function DELETE() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await disconnect(session.user.id, 'vercel')

  return NextResponse.json({ success: true })
}
