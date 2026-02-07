import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { db } from '@/lib/db/client'
import { keys, vercelSubscriptions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'
import { listProjects, VercelProject } from '@/lib/vercel-client/projects'

interface ProjectWithSubscription extends VercelProject {
  isSubscribed: boolean
  subscriptionId: string | null
  autoFixEnabled: boolean
}

// GET - List user's Vercel projects with subscription status
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Vercel token
    const [vercelKey] = await db
      .select()
      .from(keys)
      .where(and(eq(keys.userId, session.user.id), eq(keys.provider, 'vercel')))
      .limit(1)

    const vercelToken = vercelKey ? decrypt(vercelKey.value) : process.env.VERCEL_API_KEY

    if (!vercelToken) {
      return NextResponse.json({
        success: false,
        error: 'No Vercel API key configured',
        needsVercelToken: true,
        projects: [],
      })
    }

    // Fetch projects from Vercel
    const projects = await listProjects(vercelToken)

    // Get user's existing subscriptions
    const subscriptions = await db
      .select()
      .from(vercelSubscriptions)
      .where(eq(vercelSubscriptions.userId, session.user.id))

    const subscriptionMap = new Map(subscriptions.map((s) => [s.projectId, s]))

    // Merge project data with subscription status
    const projectsWithStatus: ProjectWithSubscription[] = projects.map((project) => {
      const subscription = subscriptionMap.get(project.id)
      return {
        ...project,
        isSubscribed: !!subscription,
        subscriptionId: subscription?.id || null,
        autoFixEnabled: subscription?.enabled ?? false,
      }
    })

    // Sort: subscribed first, then by name
    projectsWithStatus.sort((a, b) => {
      if (a.isSubscribed && !b.isSubscribed) return -1
      if (!a.isSubscribed && b.isSubscribed) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      projects: projectsWithStatus,
    })
  } catch (error) {
    console.error('Error fetching Vercel projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
