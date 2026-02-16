import { createHmac } from 'crypto'
import type { Events } from '@vercel/sdk/models/createwebhookop'

export type VercelWebhookEventType =
  | 'deployment.canceled'
  | 'deployment.created'
  | 'deployment.error'
  | 'deployment.ready'
  | 'deployment.succeeded'
  | 'deployment.promoted'
  | 'deployment-error'

export interface VercelWebhookPayload {
  type: VercelWebhookEventType
  payload: {
    deployment: {
      id: string
      url: string
      name: string
      meta?: Record<string, string>
    }
    project: {
      id: string
    }
    target?: string
    team?: {
      id: string
    }
    user: {
      id: string
    }
    links?: {
      deployment?: string
      project?: string
    }
  }
  id: string
  createdAt: string
  region?: string
}

export function verifyVercelWebhook(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false

  const hmac = createHmac('sha1', secret)
  hmac.update(body)
  const expected = `sha1=${hmac.digest('hex')}`

  try {
    return signature === expected
  } catch {
    return false
  }
}

export function parseWebhookPayload(body: string): VercelWebhookPayload {
  return JSON.parse(body)
}

export function isDeploymentFailure(payload: VercelWebhookPayload): boolean {
  return payload.type === 'deployment.error' || payload.type === 'deployment-error'
}

export const DEPLOYMENT_ERROR_EVENTS: Events[] = ['deployment.error']
