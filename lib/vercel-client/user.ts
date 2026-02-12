import type { VercelUser } from './types'

export async function fetchUser(accessToken: string): Promise<VercelUser | undefined> {
  // Try v2/user endpoint first (returns defaultTeamId which is needed for project listing)
  const response = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (response.ok) {
    const data = (await response.json()) as unknown
    const user = extractUser(data)
    if (user) {
      return user
    }
  }

  // Fallback to OAuth userinfo endpoint
  const userInfoResponse = await fetch('https://api.vercel.com/login/oauth/userinfo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (userInfoResponse.ok) {
    const userInfo = (await userInfoResponse.json()) as {
      sub?: string
      email?: string
      name?: string
      preferred_username?: string
      picture?: string
    }

    if (userInfo.sub && userInfo.preferred_username && userInfo.email) {
      return {
        uid: userInfo.sub,
        id: userInfo.sub,
        username: userInfo.preferred_username,
        email: userInfo.email,
        name: userInfo.name ?? undefined,
        avatar: userInfo.picture ?? undefined,
      }
    }
  }

  console.error('Failed to fetch user from all endpoints')
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
