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
  let projectId = searchParams.get('projectId') ?? undefined
  const repo = searchParams.get('repo') ?? undefined
  const state = searchParams.get('state') ?? undefined
  const target = searchParams.get('target') ?? undefined
  const teamId = connection.teamId ?? undefined

  // If repo is provided but projectId is not, try to resolve projectId
  if (repo && !projectId) {
    // 1. Check subscriptions (fastest)
    const subscription = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, session.user.id), eq(subscriptions.githubRepoFullName, repo)),
    })

    if (subscription) {
      projectId = subscription.platformProjectId
    } else {
      // 2. Fallback: Check Vercel Projects (slower but covers non-monitored projects)
      // We need to import listVercelProjects if not available or assume it's there
      // Note: listVercelProjects is already imported at the top
      try {
        const { listVercelProjects } = await import('@/lib/integrations/vercel/client')
        // 2. Fallback: Check Vercel Projects using optimized filter
        const projects = await listVercelProjects(teamId, token, { repo })

        if (projects.length > 0) {
          // Cast safely as the unified response type might vary
          const project = projects[0] as any
          projectId = project.id
        }
      } catch (err) {
        console.warn('Failed to lookup project by repo', err)
      }
    }
  }

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

    // Also filter local deployments by the resolved projectId if we have one,
    // or just rely on the Vercel IDs which are now filtered.
    // The existing logic joins on subscriptions and checks platformDeploymentId.

    // We already filtered Vercel deployments (if we found a projectId).
    // If we didn't find a projectId for the repo, vercelDeployments will optionally be ALL deployments (if projectId is undefined),
    // or empty/specific if we did.

    // BUT if we couldn't resolve projectId from repo, we might still be returning ALL deployments for the user/team.
    // We should probably filter the results by githubRepoFullName manually if projectId lookup failed but repo was requested.

    let filteredVercelDeployments = vercelDeployments
    if (repo && !projectId) {
      // We requested a repo, but couldn't find a project ID to filter by API.
      // Filter the results manually.
      filteredVercelDeployments = vercelDeployments.filter((d) => d.meta?.githubRepoFullName === repo)
    }

    const finalDeploymentIds = filteredVercelDeployments.map((d) => d.id)

    const localDeployments =
      finalDeploymentIds.length > 0
        ? await db
            .select({
              deployment: deployments,
              subscription: subscriptions,
            })
            .from(deployments)
            .innerJoin(subscriptions, eq(deployments.subscriptionId, subscriptions.id))
            .where(
              and(
                eq(subscriptions.userId, session.user.id),
                inArray(deployments.platformDeploymentId, finalDeploymentIds),
              ),
            )
        : []

    const localMap = new Map(localDeployments.map((r) => [r.deployment.platformDeploymentId, r]))

    const merged: MergedDeployment[] = filteredVercelDeployments.map((d) => {
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
    console.error('Failed to list deployments', error)
    return NextResponse.json({ error: 'Failed to list deployments' }, { status: 500 })
  }
}
