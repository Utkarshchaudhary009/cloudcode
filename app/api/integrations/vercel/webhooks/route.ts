import { NextRequest, NextResponse } from 'next/server'
import { verifyVercelWebhook, parseWebhookPayload, isDeploymentFailure } from '@/lib/integrations/vercel/webhooks'
import { db } from '@/lib/db/client'
import { subscriptions, deployments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'
import { nanoid } from 'nanoid'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-vercel-webhook-signature') || ''

  let payload
  try {
    payload = parseWebhookPayload(body)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  console.log('Webhook received', { eventType: payload.type })

  if (!isDeploymentFailure(payload)) {
    return NextResponse.json({ received: true, action: 'ignored' })
  }

  const deploymentId = payload.payload.deployment.id
  const projectId = payload.payload.project.id
  const webhookDeliveryId = payload.id

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.platformProjectId, projectId))
  const subscription = subs[0]

  if (!subscription || !subscription.autoFixEnabled) {
    return NextResponse.json({ received: true, action: 'no_subscription' })
  }

  if (!subscription.webhookSecret) {
    console.error('Webhook secret not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const webhookSecret = decrypt(subscription.webhookSecret)
  if (!verifyVercelWebhook(body, signature, webhookSecret)) {
    console.error('Invalid webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const fixId = nanoid()

  try {
    await db
      .insert(deployments)
      .values({
        id: fixId,
        subscriptionId: subscription.id,
        platformDeploymentId: deploymentId,
        webhookDeliveryId: webhookDeliveryId,
        fixStatus: 'pending',
      })
      .onConflictDoNothing({
        target: deployments.platformDeploymentId,
      })
  } catch {
    console.log('Duplicate webhook detected')
    return NextResponse.json({ received: true, action: 'duplicate' })
  }

  await inngest.send(
    {
      name: 'deployment-failure/received',
      data: {
        fixId,
        subscriptionId: subscription.id,
        deploymentId,
        projectId,
        webhookDeliveryId,
      },
    },
    {
      idempotency: {
        key: `vercel-webhook:${webhookDeliveryId}`,
        expiresIn: '24h',
      },
    },
  )

  console.log('Fix queued', { fixId })
  return NextResponse.json({ received: true, action: 'queued', fixId })
}
