import type { VercelUser } from './types'

export async function fetchUser(accessToken: string): Promise<VercelUser | undefined> {
  // Try the user endpoint
  let response = await fetch('https://api.vercel.com/v2/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (response.status !== 200) {
    console.error(`Failed to fetch user from v2 endpoint: ${response.status} ${await response.text()}`)

    // Fallback to www/user endpoint
    response = await fetch('https://vercel.com/api/www/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (response.status !== 200) {
      console.error(`Failed to fetch user from www endpoint: ${response.status} ${await response.text()}`)
      return undefined
    }
  }

  // Try to parse response - format may vary by endpoint
  const data = (await response.json()) as unknown
  const user = extractUser(data)

  if (!user) {
    console.error('No user data in response')
    return undefined
  }

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
    (typeof value.avatar === 'string' || value.avatar === undefined || value.avatar === null)
  )
}
