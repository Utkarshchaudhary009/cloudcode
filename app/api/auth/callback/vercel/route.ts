import { type NextRequest } from 'next/server'
import { OAuth2Client, type OAuth2Tokens } from 'arctic'
import { createSession, saveSession } from '@/lib/session/create'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { users, accounts, tasks, connectors, keys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { encrypt } from '@/lib/crypto'
import { fetchUser } from '@/lib/vercel-client/user'

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieStore = await cookies()
  const storedState = cookieStore.get(`vercel_oauth_state`)?.value ?? null
  const storedVerifier = cookieStore.get(`vercel_oauth_code_verifier`)?.value ?? null
  const storedRedirectTo = cookieStore.get(`vercel_oauth_redirect_to`)?.value ?? null
  const storedUserId = cookieStore.get(`vercel_oauth_user_id`)?.value ?? null // Required for connect flow

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
    tokens = await client.validateAuthorizationCode('https://api.vercel.com/login/oauth/token', code, storedVerifier)
  } catch (error) {
    console.error('[Vercel Callback] Validation failed:', error)
    if (error instanceof Error) {
      console.error('[Vercel Callback] Error Name:', error.name)
      console.error('[Vercel Callback] Error Message:', error.message)
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to validate authorization code: ${errorMessage}`, {
      status: 400,
    })
  }

  // Handle PKCE/token expiration safety
  let expiresAt: Date | undefined
  try {
    const expiresAtRaw = tokens.accessTokenExpiresAt()
    if (expiresAtRaw) {
      expiresAt = expiresAtRaw
    }
  } catch (e) {
    // If accessTokenExpiresAt() fails or is missing
    console.warn('[Vercel Callback] Failed to get expiration time')
  }

  if (storedUserId) {
    // CONNECT FLOW: Add Vercel account to existing GitHub user
    console.log('[Vercel Callback] Connect flow for user:', storedUserId)

    // Fetch Vercel user info to get their Vercel UID
    const vercelUser = await fetchUser(tokens.accessToken())
    if (!vercelUser) {
      return new Response('Failed to fetch Vercel user info', { status: 500 })
    }

    const externalId = vercelUser.uid || vercelUser.id || vercelUser.username
    const encryptedToken = encrypt(tokens.accessToken())
    const encryptedRefreshToken = tokens.hasRefreshToken() ? encrypt(tokens.refreshToken()!) : null

    // Check if this Vercel account is already connected somewhere
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.provider, 'vercel'), eq(accounts.externalUserId, externalId)))
      .limit(1)

    if (existingAccount.length > 0) {
      const connectedUserId = existingAccount[0].userId

      // If the Vercel account belongs to a different user, we need to merge accounts
      if (connectedUserId !== storedUserId) {
        console.log(
          `[Vercel Callback] Merging accounts: Vercel account ${externalId} belongs to user ${connectedUserId}, connecting to user ${storedUserId}`,
        )

        // Transfer all tasks, connectors, accounts, and keys from old user to new user
        await db.update(tasks).set({ userId: storedUserId }).where(eq(tasks.userId, connectedUserId))
        await db.update(connectors).set({ userId: storedUserId }).where(eq(connectors.userId, connectedUserId))
        await db.update(accounts).set({ userId: storedUserId }).where(eq(accounts.userId, connectedUserId))
        await db.update(keys).set({ userId: storedUserId }).where(eq(keys.userId, connectedUserId))

        // Delete the old user record (this will cascade delete their accounts/keys)
        await db.delete(users).where(eq(users.id, connectedUserId))

        console.log(`[Vercel Callback] Account merge complete. Old user ${connectedUserId} merged into ${storedUserId}`)

        // Update the Vercel account token
        await db
          .update(accounts)
          .set({
            userId: storedUserId,
            accessToken: encryptedToken,
            refreshToken: encryptedRefreshToken,
            expiresAt: expiresAt ?? null,
            username: vercelUser.username,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existingAccount[0].id))
      } else {
        // Same user, just update the token
        await db
          .update(accounts)
          .set({
            accessToken: encryptedToken,
            refreshToken: encryptedRefreshToken,
            expiresAt: expiresAt ?? null,
            username: vercelUser.username,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existingAccount[0].id))
      }
    } else {
      // No existing Vercel account connection, create a new one
      await db.insert(accounts).values({
        id: nanoid(),
        userId: storedUserId,
        provider: 'vercel',
        externalUserId: externalId,
        accessToken: encryptedToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresAt ?? null,
        username: vercelUser.username,
      })
    }

    // Clean up cookies
    cookieStore.delete(`vercel_oauth_state`)
    cookieStore.delete(`vercel_oauth_code_verifier`)
    cookieStore.delete(`vercel_oauth_redirect_to`)
    cookieStore.delete(`vercel_oauth_user_id`)

    // Redirect back to app
    return Response.redirect(new URL(storedRedirectTo, req.nextUrl.origin))
  }

  // SIGN-IN FLOW: Create a new session for the Vercel user
  const session = await createSession({
    accessToken: tokens.accessToken(),
    expiresAt: expiresAt?.getTime(),
    refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
  })

  if (!session) {
    console.error('[Vercel Callback] Failed to create session')
    return new Response('Failed to create session', { status: 500 })
  }

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: storedRedirectTo,
    },
  })

  await saveSession(response, session)

  cookieStore.delete(`vercel_oauth_state`)
  cookieStore.delete(`vercel_oauth_code_verifier`)
  cookieStore.delete(`vercel_oauth_redirect_to`)
  cookieStore.delete(`vercel_oauth_user_id`)

  return response
}
