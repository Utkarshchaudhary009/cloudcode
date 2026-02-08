import { type NextRequest } from 'next/server'
import { OAuth2Client, type OAuth2Tokens } from 'arctic'
import { createSession, saveSession } from '@/lib/session/create'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieStore = await cookies()
  const storedState = cookieStore.get(`vercel_oauth_state`)?.value ?? null
  const storedVerifier = cookieStore.get(`vercel_oauth_code_verifier`)?.value ?? null
  const storedRedirectTo = cookieStore.get(`vercel_oauth_redirect_to`)?.value ?? null

  if (!code) {
    return new Response('Missing code param', { status: 400 })
  }
  if (!state) {
    return new Response('Missing state param', { status: 400 })
  }
  if (!storedState) {
    return new Response('Missing stored state cookie', { status: 400 })
  }
  if (!storedVerifier) {
    return new Response('Missing stored verifier cookie', { status: 400 })
  }
  if (storedState !== state) {
    return new Response('State mismatch', { status: 400 })
  }
  if (!storedRedirectTo) {
    return new Response('Missing stored redirect cookie', { status: 400 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback/vercel`
  console.log('[Vercel Callback] Origin:', req.nextUrl.origin)
  console.log('[Vercel Callback] Redirect URI:', redirectUri)

  const client = new OAuth2Client(
    process.env.NEXT_PUBLIC_VERCEL_CLIENT_ID ?? '',
    process.env.VERCEL_CLIENT_SECRET ?? '',
    redirectUri,
  )

  let tokens: OAuth2Tokens

  try {
    tokens = await client.validateAuthorizationCode(
      'https://api.vercel.com/v2/oauth/access_token',
      code,
      storedVerifier,
    )
  } catch (error) {
    console.error('[Vercel Callback] Validation failed:', error)
    if (error instanceof Error) {
      console.error('[Vercel Callback] Error Name:', error.name)
      console.error('[Vercel Callback] Error Message:', error.message)
      // If it's a fetch error or arctic error, it might have more details
      console.error('[Vercel Callback] Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to validate authorization code: ${errorMessage}. Check logs for details.`, {
      status: 400,
    })
  }

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: storedRedirectTo,
    },
  })

  const session = await createSession({
    accessToken: tokens.accessToken(),
    expiresAt: tokens.accessTokenExpiresAt().getTime(),
    refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
  })

  if (!session) {
    console.error('[Vercel Callback] Failed to create session')
    return new Response('Failed to create session', { status: 500 })
  }

  // Note: Vercel tokens are already stored in users table by upsertUser() in createSession()

  await saveSession(response, session)

  cookieStore.delete(`vercel_oauth_state`)
  cookieStore.delete(`vercel_oauth_code_verifier`)
  cookieStore.delete(`vercel_oauth_redirect_to`)

  return response
}
