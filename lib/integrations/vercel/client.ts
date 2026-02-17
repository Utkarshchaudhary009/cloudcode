import 'server-only'

import { Vercel } from '@vercel/sdk'
import type { Events } from '@vercel/sdk/models/createwebhookop'
import { getUserVercelToken } from './token'

export interface VercelDeployment {
  id: string
  name: string
  url: string
  state: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
  target: 'production' | 'preview'
  projectId: string
  createdAt: number
  inspectorUrl?: string
  meta?: {
    githubCommitSha?: string
    githubCommitMessage?: string
    githubRepoFullName?: string
  }
}

export interface ListDeploymentsOptions {
  projectId?: string
  projectIds?: string[]
  limit?: number
  since?: number
  state?: string
  target?: string
  teamId?: string
  token?: string
}

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

export async function listVercelProjects(
  teamId?: string,
  token?: string,
  options?: { repo?: string; repoId?: string; repoUrl?: string },
) {
  const client = await getVercelClient(token)
  const response = await client.projects.getProjects({
    teamId,
    repo: options?.repo,
    repoId: options?.repoId,
    repoUrl: options?.repoUrl,
  })
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

export async function listVercelDeployments(options: ListDeploymentsOptions): Promise<{
  deployments: VercelDeployment[]
  pagination: { next?: number }
}> {
  const client = await getVercelClient(options.token)

  const response = await client.deployments.getDeployments({
    teamId: options.teamId,
    projectId: options.projectId,
    projectIds: options.projectIds,
    limit: options.limit ?? 20,
    since: options.since,
    state: options.state,
    target: options.target,
  })

  const deployments: VercelDeployment[] = (response.deployments ?? []).map((d) => ({
    id: d.uid,
    name: d.name,
    url: d.url ?? '',
    state: (d.state ?? 'QUEUED') as VercelDeployment['state'],
    target: (d.target ?? 'preview') as VercelDeployment['target'],
    projectId: d.projectId ?? '',
    createdAt: d.created ?? Date.now(),
    inspectorUrl: d.inspectorUrl ?? undefined,
    meta: d.meta
      ? {
          githubCommitSha: d.meta.githubCommitSha,
          githubCommitMessage: d.meta.githubCommitMessage,
          githubRepoFullName: d.meta.githubRepoFullName,
        }
      : undefined,
  }))

  return {
    deployments,
    pagination: {
      next: response.pagination?.next ?? undefined,
    },
  }
}
