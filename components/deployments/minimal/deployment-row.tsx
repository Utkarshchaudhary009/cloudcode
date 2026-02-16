'use client'

import { ExternalLink, Bot, GitPullRequest, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { MergedDeployment } from '@/lib/types/deployments'
import type { FixStatus } from '@/lib/integrations/types'

interface DeploymentRowProps {
  deployment: MergedDeployment
}

function getStateIcon(state: MergedDeployment['state']) {
  switch (state) {
    case 'BUILDING':
    case 'QUEUED':
      return <span className="text-blue-500">●</span>
    case 'ERROR':
      return <span className="text-red-500">●</span>
    case 'READY':
      return <span className="text-green-500">✓</span>
    case 'CANCELED':
      return <span className="text-gray-400">○</span>
    default:
      return <span className="text-gray-400">○</span>
  }
}

function getFixStatusOverlay(fixStatus?: FixStatus) {
  if (!fixStatus) return null

  switch (fixStatus) {
    case 'analyzing':
    case 'fixing':
    case 'reviewing':
      return <Bot className="size-4 text-yellow-500" />
    case 'pr_created':
    case 'merged':
      return <span className="text-green-500">●</span>
    case 'failed':
      return <span className="text-orange-500">⚠</span>
    default:
      return null
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isFixing(fixStatus?: FixStatus): boolean {
  return fixStatus === 'analyzing' || fixStatus === 'fixing' || fixStatus === 'reviewing'
}

export function MinimalDeploymentRow({ deployment }: DeploymentRowProps) {
  const isError = deployment.state === 'ERROR'
  const hasFix = deployment.fixStatus && deployment.fixStatus !== 'pending' && deployment.fixStatus !== 'skipped'
  const fixing = isFixing(deployment.fixStatus)

  const handleClick = () => {
    window.open(deployment.inspectorUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer border-b border-border/50 transition-colors group"
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="flex-shrink-0 w-5 text-center">{getStateIcon(deployment.state)}</span>
        <span className="font-medium truncate max-w-[200px]">{deployment.name}</span>
        {deployment.githubRepoFullName && (
          <span className="text-muted-foreground text-sm truncate hidden sm:inline">
            {deployment.githubRepoFullName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="w-10 text-right">{formatRelativeTime(deployment.createdAt)}</span>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <a
            href={deployment.inspectorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
          >
            Open <ExternalLink className="size-3" />
          </a>

          {isError && !hasFix && deployment.githubRepoFullName && (
            <Link
              href={`/?repo=${encodeURIComponent(`https://github.com/${deployment.githubRepoFullName}`)}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
            >
              Fix <Bot className="size-3" />
            </Link>
          )}

          {fixing && deployment.taskId && (
            <Link
              href={`/tasks/${deployment.taskId}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded transition-colors"
            >
              <Loader2 className="size-3 animate-spin" />
              Task →
            </Link>
          )}

          {deployment.fixStatus === 'pr_created' && deployment.prUrl && (
            <a
              href={deployment.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded transition-colors"
            >
              <GitPullRequest className="size-3" />
              PR #{deployment.prNumber} <ExternalLink className="size-3" />
            </a>
          )}

          {deployment.fixStatus === 'merged' && deployment.prUrl && (
            <a
              href={deployment.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded transition-colors"
            >
              <GitPullRequest className="size-3" />
              PR #{deployment.prNumber} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
