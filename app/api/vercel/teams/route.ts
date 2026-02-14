import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/session/get-server-session'
import { getOAuthToken } from '@/lib/session/get-oauth-token'
import { fetchTeams } from '@/lib/vercel-client/teams'
import { fetchUser } from '@/lib/vercel-client/user'
import { db } from '@/lib/db/client'
import { keys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Vercel access token from multiple possible sources
    const tokenData = await getOAuthToken(session.user.id, 'vercel')
    let vercelToken = tokenData?.accessToken

    if (!vercelToken) {
      // Check for manually added API key
      const [vercelKey] = await db
        .select()
        .from(keys)
        .where(and(eq(keys.userId, session.user.id), eq(keys.provider, 'vercel')))
        .limit(1)

      vercelToken = vercelKey ? decrypt(vercelKey.value) : undefined
    }

    if (!vercelToken) {
      console.log('[api/vercel/teams] No Vercel token found for user:', session.user.id)
      return NextResponse.json({ 
        scopes: [], 
        needsVercelAuth: true,
        success: false,
        error: 'Vercel connection required' 
      })
    }

    // Fetch user info and teams
    const [user, teams] = await Promise.all([fetchUser(vercelToken), fetchTeams(vercelToken)])

    if (!user) {
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 500 })
    }

    // Build scopes list: personal account + teams
    // Use defaultTeamId for personal scope (Vercel now requires teamId even for hobby accounts)
    const personalId = user.defaultTeamId || user.uid || user.id || ''
    const scopes = [
      {
        id: personalId,
        slug: user.username,
        name: user.name || user.username,
        type: 'personal' as const,
      },
      ...(teams || [])
        .filter((team) => team.id !== personalId)
        .map((team) => ({
          id: team.id,
          slug: team.slug,
          name: team.name,
          type: 'team' as const,
        })),
    ]

    return NextResponse.json({ scopes })
  } catch (error) {
    console.error('Error fetching Vercel teams:', error)
    return NextResponse.json({ error: 'Failed to fetch Vercel teams' }, { status: 500 })
  }
}
