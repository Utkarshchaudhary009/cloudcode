import type { VercelUser } from './types'

/**
 * Fetch user info from Vercel API using an Integration/OAuth access token.
 * Uses the /v2/user endpoint which works with API-scoped tokens (user, team, project, deployment).
 * Note: This is for Vercel Integration OAuth, not OIDC "Sign in with Vercel".
 */
export async function fetchUser(accessToken: string): Promise<VercelUser | undefined> {
  console.log('[fetchUser] Fetching user from Vercel API v2/user')

  const response = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  console.log('[fetchUser] v2/user response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[fetchUser] v2/user failed:', response.status, errorText)
    return undefined
  }

  const data = (await response.json()) as unknown
  console.log('[fetchUser] v2/user response data keys:', Object.keys(data || {}))

  const user = extractUser(data)
  if (user) {
    console.log('[fetchUser] Successfully extracted user')
    return user
  }

  console.error('[fetchUser] Failed to extract user from response')
  return undefined
}

function extractUser(payload: unknown): VercelUser | undefined {
  if (!isRecord(payload)) {
    return undefined
  }

  const record = payload

  if (record.user && isRecord(record.user)) {
    const directUser = record.user
    if (directUser.user && isRecord(directUser.user)) {
      const nestedUser = directUser.user
      if (isVercelUser(nestedUser)) {
        return nestedUser
      }
    }
    if (isVercelUser(directUser)) {
      return directUser
    }
  }

  if (isVercelUser(record)) {
    return record
  }

  if (record.data && isRecord(record.data)) {
    const dataRecord = record.data
    if (dataRecord.user && isRecord(dataRecord.user)) {
      const nestedUser = dataRecord.user
      if (isVercelUser(nestedUser)) {
        return nestedUser
      }
    }
    if (isVercelUser(dataRecord)) {
      return dataRecord
    }
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isVercelUser(value: unknown): value is VercelUser {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.username === 'string' &&
    typeof value.email === 'string' &&
    (typeof value.name === 'string' || value.name === undefined || value.name === null) &&
    (typeof value.avatar === 'string' || value.avatar === undefined || value.avatar === null) &&
    (typeof value.uid === 'string' || typeof value.id === 'string' || value.uid === undefined)
  )
}
