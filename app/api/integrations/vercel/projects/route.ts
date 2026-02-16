import { NextRequest, NextResponse } from 'next/server'
import { listVercelProjects } from '@/lib/integrations/vercel/client'
import { getServerSession } from '@/lib/session/get-server-session'
import { getDecryptedToken } from '@/lib/integrations/connection-manager'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await getDecryptedToken(session.user.id, 'vercel')
  if (!token) {
    return NextResponse.json({ error: 'Vercel not connected' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get('teamId') ?? undefined

  try {
    const projects = await listVercelProjects(teamId, token)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Failed to list projects')
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}
