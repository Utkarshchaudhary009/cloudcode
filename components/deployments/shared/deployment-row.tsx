'use client'

import { ExternalLink, GitBranch } from 'lucide-react'
import { FixStatusBadge } from './fix-status-badge'
import type { FixStatus, ErrorType } from '@/lib/integrations/types'

interface DeploymentRowProps {
  deployment: {
    id: string
    platformDeploymentId: string
    fixStatus: FixStatus
    errorType: ErrorType | null
    errorMessage: string | null
    prUrl: string | null
    createdAt: Date | string
    githubRepoFullName: string | null
    platformProjectName: string
  }
}

const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  typescript: 'TypeScript',
  dependency: 'Dependency',
  config: 'Config',
  runtime: 'Runtime',
  build: 'Build',
  other: 'Other',
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export function DeploymentRow({ deployment }: DeploymentRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium truncate">{deployment.platformProjectName}</span>
          {deployment.githubRepoFullName && (
            <span className="text-muted-foreground text-sm truncate hidden sm:inline">
              ({deployment.githubRepoFullName})
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {deployment.errorType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-xs">
              {ERROR_TYPE_LABELS[deployment.errorType]}
            </span>
          )}
          <span className="text-xs">{formatRelativeTime(deployment.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <FixStatusBadge status={deployment.fixStatus} />

        {deployment.prUrl && (
          <a
            href={deployment.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <GitBranch className="size-3" />
            <span className="hidden sm:inline">View PR</span>
            <ExternalLink className="size-3 sm:hidden" />
          </a>
        )}
      </div>
    </div>
  )
}
