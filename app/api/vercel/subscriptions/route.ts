import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { db } from '@/lib/db/client'
import { vercelSubscriptions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils/id'
import { Vercel } from '@vercel/sdk'
import { decrypt } from '@/lib/crypto'

// Get user's Vercel token
async function getVercelToken(userId: string): Promise<string | null> {
  // First try user's stored Vercel API key
  const { keys } = await import('@/lib/db/schema')
  const [vercelKey] = await db
    .select()
    .from(keys)
    .where(and(eq(keys.userId, userId), eq(keys.provider, 'vercel')))
    .limit(1)

  if (vercelKey) {
    return decrypt(vercelKey.value)
  }

  // Fall back to system Vercel token
  return process.env.VERCEL_API_KEY || null
}

// GET - List user's subscriptions
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscriptions = await db
      .select()
      .from(vercelSubscriptions)
      .where(eq(vercelSubscriptions.userId, session.user.id))

    return NextResponse.json({ success: true, subscriptions })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

// POST - Create a new subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, projectName, repoUrl, teamId, selectedAgent, selectedModel, maxAttempts } = body

    if (!projectId || !projectName) {
      return NextResponse.json({ error: 'Project ID and name are required' }, { status: 400 })
    }

    // Check if already subscribed
    const existing = await db
      .select()
      .from(vercelSubscriptions)
      .where(and(eq(vercelSubscriptions.userId, session.user.id), eq(vercelSubscriptions.projectId, projectId)))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Already subscribed to this project' }, { status: 409 })
    }

    // Get Vercel token to create webhook
    const vercelToken = await getVercelToken(session.user.id)
    let webhookId: string | undefined

    if (vercelToken) {
      try {
        const vercel = new Vercel({ bearerToken: vercelToken })

        // Create webhook for this project
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/api/webhooks/vercel`

        const webhook = await vercel.webhooks.createWebhook({
          requestBody: {
            url: webhookUrl,
            events: ['deployment.error', 'deployment.ready'],
            projectIds: [projectId],
          },
        })

        webhookId = webhook.id
        console.log('Created Vercel webhook for project')
      } catch (webhookError) {
        console.error('Failed to create Vercel webhook:', webhookError)
        // Continue without webhook - user can set up manually
      }
    }

    // Create subscription
    const subscriptionId = generateId()
    await db.insert(vercelSubscriptions).values({
      id: subscriptionId,
      userId: session.user.id,
      projectId,
      projectName,
      repoUrl: repoUrl || null,
      teamId: teamId || null,
      webhookId,
      enabled: true,
      selectedAgent: selectedAgent || 'openai',
      selectedModel: selectedModel || null,
      maxAttempts: maxAttempts || 5,
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscriptionId,
        projectId,
        projectName,
        webhookId,
      },
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}

// DELETE - Remove a subscription
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Get subscription to check ownership and get webhook ID
    const [subscription] = await db
      .select()
      .from(vercelSubscriptions)
      .where(and(eq(vercelSubscriptions.id, subscriptionId), eq(vercelSubscriptions.userId, session.user.id)))
      .limit(1)

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Try to delete webhook if exists
    if (subscription.webhookId) {
      const vercelToken = await getVercelToken(session.user.id)
      if (vercelToken) {
        try {
          const vercel = new Vercel({ bearerToken: vercelToken })
          await vercel.webhooks.deleteWebhook({ id: subscription.webhookId })
          console.log('Deleted Vercel webhook')
        } catch (webhookError) {
          console.error('Failed to delete Vercel webhook:', webhookError)
        }
      }
    }

    // Delete subscription
    await db.delete(vercelSubscriptions).where(eq(vercelSubscriptions.id, subscriptionId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }
}

// PATCH - Update subscription settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, enabled, selectedAgent, selectedModel, maxAttempts } = body

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Verify ownership
    const [subscription] = await db
      .select()
      .from(vercelSubscriptions)
      .where(and(eq(vercelSubscriptions.id, id), eq(vercelSubscriptions.userId, session.user.id)))
      .limit(1)

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Update subscription
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (typeof enabled === 'boolean') updateData.enabled = enabled
    if (selectedAgent) updateData.selectedAgent = selectedAgent
    if (selectedModel !== undefined) updateData.selectedModel = selectedModel
    if (maxAttempts) updateData.maxAttempts = maxAttempts

    await db.update(vercelSubscriptions).set(updateData).where(eq(vercelSubscriptions.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
