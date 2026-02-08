import type { VercelUser } from './types'

export async function fetchUser(accessToken: string): Promise<VercelUser | undefined> {
  // Try the user endpoint
  const response = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (response.status !== 200) {
    const errorText = await response.text()
    console.error('[fetchUser] Failed to fetch user:', response.status)
    return undefined
  }

  // Try to parse response - format may vary by endpoint
  const data = (await response.json()) as unknown
  console.log('[fetchUser] Raw response structure:', JSON.stringify(data, null, 2).substring(0, 500))
  const user = extractUser(data)

  if (!user) {
    console.error('[fetchUser] Could not extract user from response')
    return undefined
  }

  console.log('[fetchUser] Extracted user:', user.username, 'uid:', user.uid, 'id:', user.id)
  return user
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
