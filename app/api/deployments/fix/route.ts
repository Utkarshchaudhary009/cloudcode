import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { deployments, subscriptions, integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { deploymentId } = body

  if (!deploymentId) {
    return NextResponse.json({ error: 'Deployment ID required' }, { status: 400 })
  }

  const results = await db
    .select({
      deployment: deployments,
      subscription: subscriptions,
      integration: integrations,
    })
    .from(deployments)
    .innerJoin(subscriptions, eq(deployments.subscriptionId, subscriptions.id))
    .innerJoin(integrations, eq(subscriptions.integrationId, integrations.id))
    .where(eq(deployments.id, deploymentId))
    .limit(1)

  const result = results[0]

  if (!result) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })
  }

  if (result.integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!['failed', 'skipped'].includes(result.deployment.fixStatus)) {
    return NextResponse.json({ error: 'Can only trigger fix for failed or skipped deployments' }, { status: 400 })
  }

  await db
    .update(deployments)
    .set({
      fixStatus: 'pending',
      fixAttemptNumber: (result.deployment.fixAttemptNumber ?? 0) + 1,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId))

  await inngest.send({
    name: 'deployment-failure/received',
    data: {
      fixId: deploymentId,
      subscriptionId: result.subscription.id,
      deploymentId: result.deployment.platformDeploymentId,
      projectId: result.subscription.platformProjectId,
      webhookDeliveryId: result.deployment.webhookDeliveryId ?? undefined,
    },
  })

  return NextResponse.json({ success: true, message: 'Fix triggered' })
}
