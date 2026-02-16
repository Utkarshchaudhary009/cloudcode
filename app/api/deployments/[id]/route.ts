import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { deployments, subscriptions, integrations, tasks, fixRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const results = await db
    .select({
      deployment: deployments,
      subscription: subscriptions,
      integration: integrations,
    })
    .from(deployments)
    .innerJoin(subscriptions, eq(deployments.subscriptionId, subscriptions.id))
    .innerJoin(integrations, eq(subscriptions.integrationId, integrations.id))
    .where(eq(deployments.id, id))
    .limit(1)

  const result = results[0]

  if (!result) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })
  }

  if (result.integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let task = null
  if (result.deployment.taskId) {
    const taskResults = await db.select().from(tasks).where(eq(tasks.id, result.deployment.taskId)).limit(1)
    task = taskResults[0] ?? null
  }

  let matchedRule = null
  if (result.deployment.matchedRuleId) {
    const ruleResults = await db
      .select()
      .from(fixRules)
      .where(eq(fixRules.id, result.deployment.matchedRuleId))
      .limit(1)
    matchedRule = ruleResults[0] ?? null
  }

  return NextResponse.json({
    deployment: result.deployment,
    subscription: {
      id: result.subscription.id,
      platformProjectName: result.subscription.platformProjectName,
      githubRepoFullName: result.subscription.githubRepoFullName,
      autoFixEnabled: result.subscription.autoFixEnabled,
      maxFixAttempts: result.subscription.maxFixAttempts,
      notifyOnFix: result.subscription.notifyOnFix,
      fixBranchPrefix: result.subscription.fixBranchPrefix,
    },
    task,
    matchedRule,
  })
}
