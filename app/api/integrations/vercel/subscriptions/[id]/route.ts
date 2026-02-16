import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { subscriptions, integrations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'
import { decrypt } from '@/lib/crypto'
import { deleteProjectWebhook } from '@/lib/integrations/vercel/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

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

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (body.autoFixEnabled !== undefined) {
    updateData.autoFixEnabled = body.autoFixEnabled
  }
  if (body.maxFixAttempts !== undefined) {
    updateData.maxFixAttempts = body.maxFixAttempts
  }
  if (body.notifyOnFix !== undefined) {
    updateData.notifyOnFix = body.notifyOnFix
  }
  if (body.fixBranchPrefix !== undefined) {
    updateData.fixBranchPrefix = body.fixBranchPrefix
  }

  const updated = await db.update(subscriptions).set(updateData).where(eq(subscriptions.id, id)).returning()

  return NextResponse.json({ subscription: updated[0] })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

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
      const token = decrypt(integration.accessToken)
      await deleteProjectWebhook(subscription.webhookId, integration.teamId ?? undefined, token)
    } catch {
      console.error('Failed to delete webhook')
    }
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id))

  return NextResponse.json({ success: true })
}
