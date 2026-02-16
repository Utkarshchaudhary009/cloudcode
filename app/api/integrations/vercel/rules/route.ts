import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { fixRules, subscriptions, integrations } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getServerSession } from '@/lib/session/get-server-session'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const subscriptionId = searchParams.get('subscriptionId')

  if (!subscriptionId) {
    return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
  }

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId))
  const subscription = subs[0]

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const ints = await db.select().from(integrations).where(eq(integrations.id, subscription.integrationId))
  const integration = ints[0]

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rules = await db
    .select()
    .from(fixRules)
    .where(eq(fixRules.subscriptionId, subscriptionId))
    .orderBy(desc(fixRules.priority), desc(fixRules.createdAt))

  return NextResponse.json({ rules })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { subscriptionId, name, errorPattern, errorType, skipFix, customPrompt, priority, enabled } = body

  if (!subscriptionId || !name || !errorPattern) {
    return NextResponse.json({ error: 'subscriptionId, name, and errorPattern are required' }, { status: 400 })
  }

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId))
  const subscription = subs[0]

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const ints = await db.select().from(integrations).where(eq(integrations.id, subscription.integrationId))
  const integration = ints[0]

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rule = await db
    .insert(fixRules)
    .values({
      id: nanoid(),
      subscriptionId,
      name,
      errorPattern,
      errorType: errorType ?? 'other',
      skipFix: skipFix ?? false,
      customPrompt,
      priority: priority ?? 0,
      enabled: enabled ?? true,
    })
    .returning()

  return NextResponse.json({ rule: rule[0] })
}
