import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { subscriptions, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { nanoid } from 'nanoid'
import { createProjectWebhook, deleteProjectWebhook } from '@/lib/integrations/vercel/client'
import { DEPLOYMENT_ERROR_EVENTS } from '@/lib/integrations/vercel/webhooks'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userSubs = await db
    .select({
      id: subscriptions.id,
      platformProjectId: subscriptions.platformProjectId,
      platformProjectName: subscriptions.platformProjectName,
      githubRepoFullName: subscriptions.githubRepoFullName,
      webhookId: subscriptions.webhookId,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(integrations, eq(subscriptions.integrationId, integrations.id))
    .where(eq(integrations.userId, session.user.id))

  return NextResponse.json({ subscriptions: userSubs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { platformProjectId, platformProjectName, githubRepoFullName, autoFixEnabled, teamId } = body

  if (!platformProjectId || !platformProjectName || !githubRepoFullName) {
    return NextResponse.json(
      { error: 'platformProjectId, platformProjectName, and githubRepoFullName are required' },
      { status: 400 },
    )
  }

  const userIntegrations = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, session.user.id), eq(integrations.provider, 'vercel')))

  const integration = userIntegrations[0]
  if (!integration) {
    return NextResponse.json({ error: 'Vercel integration not found' }, { status: 404 })
  }

  const { decrypt: decryptToken } = await import('@/lib/crypto')
  const token = decryptToken(integration.accessToken)

  let webhookId: string | undefined
  let webhookSecret: string | undefined

  try {
    const webhook = await createProjectWebhook({
      projectIds: [platformProjectId],
      events: DEPLOYMENT_ERROR_EVENTS,
      teamId: teamId ?? integration.teamId ?? undefined,
      token,
    })
    webhookId = webhook.id
    webhookSecret = encrypt(webhook.secret)
  } catch (error) {
    console.error('Failed to create webhook')
  }

  const id = nanoid()
  await db.insert(subscriptions).values({
    id,
    userId: session.user.id,
    integrationId: integration.id,
    platformProjectId,
    platformProjectName,
    githubRepoFullName,
    autoFixEnabled: autoFixEnabled ?? true,
    webhookId,
    webhookSecret,
  })

  return NextResponse.json({ success: true, id, webhookCreated: !!webhookId })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
  }

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.id, id))
  const subscription = subs[0]

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const ints = await db.select().from(integrations).where(eq(integrations.id, subscription.integrationId))
  const integration = ints[0]

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (subscription.webhookId) {
    try {
      const { decrypt: decryptToken } = await import('@/lib/crypto')
      const token = decryptToken(integration.accessToken)
      await deleteProjectWebhook(subscription.webhookId, integration.teamId ?? undefined, token)
    } catch {
      console.error('Failed to delete webhook')
    }
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id))

  return NextResponse.json({ success: true })
}
