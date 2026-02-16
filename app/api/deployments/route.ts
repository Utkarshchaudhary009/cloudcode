import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { deployments, subscriptions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import type { FixStatus } from '@/lib/integrations/types'

const VALID_STATUSES: FixStatus[] = [
  'pending',
  'analyzing',
  'fixing',
  'reviewing',
  'pr_created',
  'merged',
  'failed',
  'skipped',
]

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')
  const repoFullName = searchParams.get('repo')

  const conditions = [eq(subscriptions.userId, session.user.id)]

  if (statusParam && VALID_STATUSES.includes(statusParam as FixStatus)) {
    conditions.push(eq(deployments.fixStatus, statusParam as FixStatus))
  }

  if (repoFullName) {
    conditions.push(eq(subscriptions.githubRepoFullName, repoFullName))
  }

  const results = await db
    .select({
      deployment: deployments,
      subscription: subscriptions,
    })
    .from(deployments)
    .innerJoin(subscriptions, eq(deployments.subscriptionId, subscriptions.id))
    .where(and(...conditions))
    .orderBy(desc(deployments.createdAt))
    .limit(100)

  return NextResponse.json({
    deployments: results.map((r) => ({
      ...r.deployment,
      githubRepoFullName: r.subscription.githubRepoFullName,
      platformProjectName: r.subscription.platformProjectName,
    })),
  })
}
