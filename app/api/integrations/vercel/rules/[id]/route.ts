import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { fixRules, subscriptions, integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/session/get-server-session'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function verifyOwnership(ruleId: string, userId: string) {
  const rules = await db.select().from(fixRules).where(eq(fixRules.id, ruleId))
  const rule = rules[0]

  if (!rule) {
    return { error: 'Rule not found', status: 404 }
  }

  if (!rule.subscriptionId) {
    return { error: 'Rule has no subscription', status: 404 }
  }

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.id, rule.subscriptionId))
  const subscription = subs[0]

  if (!subscription) {
    return { error: 'Subscription not found', status: 404 }
  }

  const ints = await db.select().from(integrations).where(eq(integrations.id, subscription.integrationId))
  const integration = ints[0]

  if (!integration || integration.userId !== userId) {
    return { error: 'Unauthorized', status: 401 }
  }

  return { rule, subscription, integration }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const result = await verifyOwnership(id, session.user.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ rule: result.rule })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const result = await verifyOwnership(id, session.user.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (body.name !== undefined) {
    updateData.name = body.name
  }
  if (body.errorPattern !== undefined) {
    updateData.errorPattern = body.errorPattern
  }
  if (body.errorType !== undefined) {
    updateData.errorType = body.errorType
  }
  if (body.skipFix !== undefined) {
    updateData.skipFix = body.skipFix
  }
  if (body.customPrompt !== undefined) {
    updateData.customPrompt = body.customPrompt
  }
  if (body.priority !== undefined) {
    updateData.priority = body.priority
  }
  if (body.enabled !== undefined) {
    updateData.enabled = body.enabled
  }

  const updated = await db.update(fixRules).set(updateData).where(eq(fixRules.id, id)).returning()

  return NextResponse.json({ rule: updated[0] })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const result = await verifyOwnership(id, session.user.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await db.delete(fixRules).where(eq(fixRules.id, id))

  return NextResponse.json({ success: true })
}
