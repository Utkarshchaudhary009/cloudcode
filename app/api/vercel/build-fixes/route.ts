import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { db } from '@/lib/db/client'
import { buildFixes, vercelSubscriptions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { inngest } from '@/lib/inngest/client'

// GET - List build fixes for user's subscriptions
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const subscriptionId = searchParams.get('subscriptionId')

        // Get user's subscriptions
        const userSubscriptions = await db
            .select()
            .from(vercelSubscriptions)
            .where(eq(vercelSubscriptions.userId, session.user.id))

        if (userSubscriptions.length === 0) {
            return NextResponse.json({ success: true, fixes: [] })
        }

        const subscriptionIds = subscriptionId
            ? [subscriptionId]
            : userSubscriptions.map((s) => s.id)

        // Get build fixes for these subscriptions
        const fixes = await db
            .select({
                id: buildFixes.id,
                subscriptionId: buildFixes.subscriptionId,
                deploymentId: buildFixes.deploymentId,
                deploymentUrl: buildFixes.deploymentUrl,
                branch: buildFixes.branch,
                buildError: buildFixes.buildError,
                status: buildFixes.status,
                attempts: buildFixes.attempts,
                lastFixCommit: buildFixes.lastFixCommit,
                createdAt: buildFixes.createdAt,
                updatedAt: buildFixes.updatedAt,
                completedAt: buildFixes.completedAt,
                // Include subscription details
                projectName: vercelSubscriptions.projectName,
                projectId: vercelSubscriptions.projectId,
            })
            .from(buildFixes)
            .innerJoin(vercelSubscriptions, eq(buildFixes.subscriptionId, vercelSubscriptions.id))
            .where(
                subscriptionId
                    ? and(eq(buildFixes.subscriptionId, subscriptionId), eq(vercelSubscriptions.userId, session.user.id))
                    : eq(vercelSubscriptions.userId, session.user.id),
            )
            .orderBy(desc(buildFixes.createdAt))
            .limit(100)

        return NextResponse.json({ success: true, fixes })
    } catch (error) {
        console.error('Error fetching build fixes:', error)
        return NextResponse.json({ error: 'Failed to fetch build fixes' }, { status: 500 })
    }
}

// POST - Manually trigger a fix retry
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { buildFixId } = body

        if (!buildFixId) {
            return NextResponse.json({ error: 'Build fix ID is required' }, { status: 400 })
        }

        // Get build fix and verify ownership through subscription
        const [fix] = await db
            .select()
            .from(buildFixes)
            .innerJoin(vercelSubscriptions, eq(buildFixes.subscriptionId, vercelSubscriptions.id))
            .where(and(eq(buildFixes.id, buildFixId), eq(vercelSubscriptions.userId, session.user.id)))
            .limit(1)

        if (!fix) {
            return NextResponse.json({ error: 'Build fix not found' }, { status: 404 })
        }

        const buildFix = fix.build_fixes
        const subscription = fix.vercel_subscriptions

        // Check if already at max attempts
        if (buildFix.attempts >= subscription.maxAttempts) {
            return NextResponse.json({ error: 'Max attempts already reached' }, { status: 400 })
        }

        // Check if currently fixing
        if (buildFix.status === 'fixing') {
            return NextResponse.json({ error: 'Fix is already in progress' }, { status: 400 })
        }

        // Trigger fix execution
        await inngest.send({
            name: 'vercel/build-fix.execute',
            data: {
                buildFixId: buildFix.id,
                subscriptionId: subscription.id,
                attempt: buildFix.attempts + 1,
            },
        })

        return NextResponse.json({ success: true, message: 'Fix triggered' })
    } catch (error) {
        console.error('Error triggering fix:', error)
        return NextResponse.json({ error: 'Failed to trigger fix' }, { status: 500 })
    }
}
