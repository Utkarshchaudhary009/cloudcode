import { NextRequest, NextResponse } from 'next/server'
import { listVercelProjects } from '@/lib/integrations/vercel/client'
import { getServerSession } from '@/lib/session/get-server-session'
import { getDecryptedToken, getConnection } from '@/lib/integrations/connection-manager'
import type { VercelProject } from '@/lib/types/projects'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getConnection(session.user.id, 'vercel')
  if (!connection) {
    return NextResponse.json({ error: 'Vercel not connected' }, { status: 400 })
  }

  const token = await getDecryptedToken(session.user.id, 'vercel')
  if (!token) {
    return NextResponse.json({ error: 'Token retrieval failed' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get('teamId') ?? connection.teamId ?? undefined

  try {
    const projects = await listVercelProjects(teamId, token)
    const formattedProjects: VercelProject[] = (projects as VercelProject[]).map((project) => ({
      id: project.id,
      name: project.name,
      framework: project.framework,
      link: project.link
        ? {
            type: project.link.type,
            org: project.link.org,
            repo: project.link.repo,
            repoId: project.link.repoId,
          }
        : undefined,
    }))
    return NextResponse.json({ projects: formattedProjects })
  } catch (error) {
    console.error('Failed to list projects')
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}
