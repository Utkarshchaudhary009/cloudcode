import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/integrations/registry'
import { connect } from '@/lib/integrations/connection-manager'
import { getServerSession } from '@/lib/session/get-server-session'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { token, teamId, teamSlug } = body

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Valid token is required' }, { status: 400 })
  }

  const provider = providers.vercel
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 400 })
  }

  let userInfo
  try {
    userInfo = await provider.validateToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token or token expired' }, { status: 400 })
  }

  await connect(session.user.id, 'vercel', token, userInfo, teamId, teamSlug)

  return NextResponse.json({
    success: true,
    username: userInfo.username,
  })
}
