import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/integrations/registry'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token || token.length < 10) {
    return NextResponse.json({ valid: false, error: 'Valid token required' })
  }

  try {
    const provider = providers.vercel
    if (!provider) {
      return NextResponse.json({ valid: false, error: 'Provider not found' })
    }
    const userInfo = await provider.validateToken(token)
    return NextResponse.json({
      valid: true,
      username: userInfo.username,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Token is invalid or expired' })
  }
}
