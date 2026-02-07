import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db/client'
import { vercelSubscriptions, buildFixes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { generateId } from '@/lib/utils/id'

// Vercel webhook event types we care about
interface VercelDeploymentEvent {
  type: 'deployment.error' | 'deployment.ready' | 'deployment.created'
  payload: {
    deployment: {
      id: string
      url: string
      name: string
      meta?: {
        githubCommitRef?: string
        gitSource?: {
          ref?: string
        }
      }
    }
    project: {
      id: string
      name: string
    }
    team?: {
      id: string
    }
    user?: {
      id: string
    }
  }
}

// Verify Vercel webhook signature
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha1', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

// Extract branch from deployment metadata
function extractBranch(deployment: VercelDeploymentEvent['payload']['deployment']): string | null {
  return deployment.meta?.githubCommitRef || deployment.meta?.gitSource?.ref || null
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  // Parse the event
  let event: VercelDeploymentEvent
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const projectId = event.payload?.project?.id
  if (!projectId) {
    return NextResponse.json({ message: 'No project ID found, ignoring' })
  }

  // Find subscription for this project
  const [subscription] = await db
    .select()
    .from(vercelSubscriptions)
    .where(and(eq(vercelSubscriptions.projectId, projectId), eq(vercelSubscriptions.enabled, true)))
    .limit(1)

  if (!subscription) {
    return NextResponse.json({ message: 'No active subscription for this project' })
  }

  // Verify signature if webhook secret is configured
  const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = request.headers.get('x-vercel-signature')
    if (!signature || !verifySignature(body, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // Handle deployment events
  if (event.type === 'deployment.error') {
    const deployment = event.payload.deployment
    const branch = extractBranch(deployment)

    if (!branch) {
      console.log('No branch found in deployment metadata')
      return NextResponse.json({ message: 'No branch found, skipping' })
    }

    // Check if we already have a build fix for this deployment
    const existingFix = await db.select().from(buildFixes).where(eq(buildFixes.deploymentId, deployment.id)).limit(1)

    if (existingFix.length > 0) {
      return NextResponse.json({ message: 'Build fix already exists for this deployment' })
    }

    // Create a new build fix record
    const buildFixId = generateId()
    await db.insert(buildFixes).values({
      id: buildFixId,
      subscriptionId: subscription.id,
      deploymentId: deployment.id,
      deploymentUrl: `https://${deployment.url}`,
      branch,
      status: 'pending',
      attempts: 0,
    })

    // Trigger the auto-fix Inngest event
    await inngest.send({
      name: 'vercel/deployment.failed',
      data: {
        subscriptionId: subscription.id,
        deploymentId: deployment.id,
        deploymentUrl: `https://${deployment.url}`,
        branch,
        buildError: '', // Will be fetched by the Inngest function
        projectId: event.payload.project.id,
        projectName: event.payload.project.name,
      },
    })

    console.log('Deployment failure detected, auto-fix triggered')
    return NextResponse.json({ message: 'Auto-fix triggered', buildFixId })
  }

  if (event.type === 'deployment.ready') {
    const deployment = event.payload.deployment
    const branch = extractBranch(deployment)

    if (branch) {
      // Mark any pending fixes for this branch as successful
      await db
        .update(buildFixes)
        .set({
          status: 'success',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(buildFixes.subscriptionId, subscription.id), eq(buildFixes.status, 'fixing')))
    }

    return NextResponse.json({ message: 'Deployment success recorded' })
  }

  return NextResponse.json({ message: 'Event type ignored' })
}
