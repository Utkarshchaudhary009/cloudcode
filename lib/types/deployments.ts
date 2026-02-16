import type { FixStatus, ErrorType } from '@/lib/integrations/types'

export type DeploymentState = 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
export type DeploymentTarget = 'production' | 'preview'

export interface MergedDeployment {
  id: string
  name: string
  url: string
  state: DeploymentState
  target: DeploymentTarget
  createdAt: string
  projectId: string
  inspectorUrl: string
  fixStatus?: FixStatus
  prUrl?: string
  prNumber?: number
  taskId?: string
  errorMessage?: string
  errorType?: ErrorType
  githubRepoFullName?: string
}
