import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isRelativeUrl } from '@/lib/utils/is-relative-url'
import { CodeChallengeMethod, OAuth2Client, generateCodeVerifier, generateState } from 'arctic'
import { getSessionFromReq } from '@/lib/session/server'

async function getVercelAuthUrl(req: NextRequest) {
  const session = await getSessionFromReq(req)

  const client = new OAuth2Client(
    process.env.NEXT_PUBLIC_VERCEL_CLIENT_ID ?? '',
    process.env.VERCEL_CLIENT_SECRET ?? '',
    `${req.nextUrl.origin}/api/auth/callback/vercel`,
  )

  const state = generateState()
  const verifier = generateCodeVerifier()
  const url = client.createAuthorizationURLWithPKCE(
    'https://vercel.com/oauth/authorize',
    state,
    CodeChallengeMethod.S256,
    verifier,
    [], // Vercel uses default scopes
  )

  const store = await cookies()
  const redirectTo = isRelativeUrl(req.nextUrl.searchParams.get('next') ?? '/')
    ? (req.nextUrl.searchParams.get('next') ?? '/')
    : '/'

  const cookiesToSet: [string, string][] = [
    [`vercel_oauth_redirect_to`, redirectTo],
    [`vercel_oauth_state`, state],
    [`vercel_oauth_code_verifier`, verifier],
  ]

  // If user is already authenticated, this is a "Connect Vercel" flow
  if (session?.user?.id) {
    cookiesToSet.push([`vercel_oauth_user_id`, session.user.id])
  }

  for (const [key, value] of cookiesToSet) {
    store.set(key, value, {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 10, // 10 minutes
      sameSite: 'lax',
    })
  }

  return url
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = await getVercelAuthUrl(req)
  return Response.redirect(url)
}

export async function POST(req: NextRequest): Promise<Response> {
  const url = await getVercelAuthUrl(req)
  return NextResponse.json({ url })
}
