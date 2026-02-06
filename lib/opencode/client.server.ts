import { createOpencodeClient } from '@opencode-ai/sdk'

const OPENCODE_SERVER_URL = process.env.OPENCODE_SERVER_URL

export const getOpencodeClient = () => {
  if (!OPENCODE_SERVER_URL) {
    return null
  }

  return createOpencodeClient({ baseUrl: OPENCODE_SERVER_URL })
}

export const unwrapOpencodeResponse = <T>(response: { data?: T } | T | undefined | null): T | null => {
  if (!response) return null
  if (typeof response === 'object' && 'data' in response) {
    return response.data ?? null
  }
  return response as T
}
