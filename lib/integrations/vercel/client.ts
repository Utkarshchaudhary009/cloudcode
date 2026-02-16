import 'server-only'

import { Vercel } from '@vercel/sdk'
import type { Events } from '@vercel/sdk/models/createwebhookop'
import { getUserVercelToken } from './token'

interface LogEvent {
  type: string
  text?: string
  payload?: { text?: string }
}

export async function getVercelClient(token?: string): Promise<Vercel> {
  const vercelToken = token || (await getUserVercelToken())
  if (!vercelToken) throw new Error('No Vercel token available')

  return new Vercel({ bearerToken: vercelToken })
}

export async function listVercelProjects(teamId?: string, token?: string) {
  const client = await getVercelClient(token)
  const response = await client.projects.getProjects({ teamId })
  if (Array.isArray(response)) {
    return response
  }
  const resp = response as { projects?: unknown[] }
  return resp.projects || []
}

export async function getDeployment(deploymentId: string, teamId?: string, token?: string) {
  const client = await getVercelClient(token)
  return client.deployments.getDeployment({ idOrUrl: deploymentId, teamId })
}

export async function getDeploymentEvents(deploymentId: string, teamId?: string, token?: string) {
  const client = await getVercelClient(token)
  return client.deployments.getDeploymentEvents({
    idOrUrl: deploymentId,
    limit: 1000,
    direction: 'backward',
    teamId,
  })
}

export function extractLogText(event: LogEvent): string {
  if ('text' in event && typeof event.text === 'string') {
    return event.text
  }
  if ('payload' in event && event.payload && typeof event.payload.text === 'string') {
    return event.payload.text
  }
  return ''
}

const LOG_EVENT_TYPES = ['stdout', 'stderr', 'command', 'fatal'] as const

export function isLogEvent(event: unknown): event is LogEvent {
  if (!event || typeof event !== 'object') return false
  const e = event as Record<string, unknown>
  if (!('type' in e)) return false
  return LOG_EVENT_TYPES.includes(e.type as (typeof LOG_EVENT_TYPES)[number])
}

export async function getBuildLogs(deploymentId: string, teamId?: string, token?: string): Promise<string> {
  const response = await getDeploymentEvents(deploymentId, teamId, token)
  const events = Array.isArray(response) ? response : [response]

  const logEvents = events.filter(isLogEvent) as LogEvent[]
  return logEvents.reverse().map(extractLogText).filter(Boolean).join('\n')
}

export interface CreateWebhookResult {
  id: string
  secret: string
  url: string
  events: Events[]
  projectIds?: string[]
}

export interface CreateWebhookOptions {
  projectIds?: string[]
  events: Events[]
  teamId?: string
  token?: string
}

const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cloudcode1.vercel.app'

export async function createProjectWebhook(options: CreateWebhookOptions): Promise<CreateWebhookResult> {
  const client = await getVercelClient(options.token)
  const webhookUrl = `${WEBHOOK_BASE_URL}/api/integrations/vercel/webhooks`
  const result = await client.webhooks.createWebhook({
    teamId: options.teamId,
    requestBody: {
      url: webhookUrl,
      events: options.events,
      projectIds: options.projectIds,
    },
  })

  return {
    id: result.id,
    secret: result.secret,
    url: result.url,
    events: result.events,
    projectIds: result.projectIds,
  }
}

export async function deleteProjectWebhook(webhookId: string, teamId?: string, token?: string) {
  const client = await getVercelClient(token)
  return client.webhooks.deleteWebhook({ id: webhookId, teamId })
}
