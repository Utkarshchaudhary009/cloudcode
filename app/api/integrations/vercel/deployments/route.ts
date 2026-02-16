import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getConnection, getDecryptedToken } from '@/lib/integrations/connection-manager'
import { listVercelDeployments, type VercelDeployment } from '@/lib/integrations/vercel/client'
import { db } from '@/lib/db/client'
import { deployments, subscriptions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { MergedDeployment } from '@/lib/types/deployments'

function buildInspectorUrl(deployment: VercelDeployment, teamId?: string | null): string {
  if (deployment.inspectorUrl) {
    return deployment.inspectorUrl
  }
  if (teamId) {
    return `https://vercel.com/${teamId}/${deployment.name}/${deployment.id}`
  }
  return `https://vercel.com/${deployment.name}/${deployment.id}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getConnection(session.user.id, 'vercel')
  if (!connection) {
    return NextResponse.json({ deployments: [], pagination: {} })
  }

  const token = await getDecryptedToken(session.user.id, 'vercel')
  if (!token) {
    return NextResponse.json({ error: 'Token retrieval failed' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : undefined
  const projectId = searchParams.get('projectId') ?? undefined
  const state = searchParams.get('state') ?? undefined
  const target = searchParams.get('target') ?? undefined
  const teamId = connection.teamId ?? undefined

  try {
    const { deployments: vercelDeployments, pagination } = await listVercelDeployments({
      projectId,
      limit,
      since,
      state,
      target,
      teamId,
      token,
    })

    const deploymentIds = vercelDeployments.map((d) => d.id)
    const projectIds = [...new Set(vercelDeployments.map((d) => d.projectId))]

    const localDeployments =
      deploymentIds.length > 0
        ? await db
            .select({
              deployment: deployments,
              subscription: subscriptions,
            })
            .from(deployments)
            .innerJoin(subscriptions, eq(deployments.subscriptionId, subscriptions.id))
            .where(
              and(eq(subscriptions.userId, session.user.id), inArray(deployments.platformDeploymentId, deploymentIds)),
            )
        : []

    const localMap = new Map(localDeployments.map((r) => [r.deployment.platformDeploymentId, r]))

    const merged: MergedDeployment[] = vercelDeployments.map((d) => {
      const local = localMap.get(d.id)
      const inspectorUrl = buildInspectorUrl(d, teamId)

      return {
        id: d.id,
        name: d.name,
        url: d.url,
        state: d.state,
        target: d.target,
        createdAt: new Date(d.createdAt).toISOString(),
        projectId: d.projectId,
        inspectorUrl,
        fixStatus: local?.deployment.fixStatus,
        prUrl: local?.deployment.prUrl ?? undefined,
        prNumber: local?.deployment.prNumber ?? undefined,
        taskId: local?.deployment.taskId ?? undefined,
        errorMessage: local?.deployment.errorMessage ?? undefined,
        errorType: local?.deployment.errorType ?? undefined,
        githubRepoFullName: local?.subscription.githubRepoFullName ?? d.meta?.githubRepoFullName,
      }
    })

    return NextResponse.json({ deployments: merged, pagination })
  } catch (error) {
    console.error('Failed to list deployments')
    return NextResponse.json({ error: 'Failed to list deployments' }, { status: 500 })
  }
}
