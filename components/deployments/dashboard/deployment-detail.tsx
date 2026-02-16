'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, GitBranch, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FixStatusBadge } from '../shared/fix-status-badge'
import type { FixStatus, ErrorType } from '@/lib/integrations/types'

interface DeploymentDetailProps {
  deploymentId: string
}

interface DeploymentDetail {
  id: string
  platformDeploymentId: string
  fixStatus: FixStatus
  errorType: ErrorType | null
  errorMessage: string | null
  errorContext: string | null
  prUrl: string | null
  prNumber: number | null
  fixBranchName: string | null
  fixSummary: string | null
  fixDetails: string | null
  logs: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  fixAttemptNumber: number | null
}

interface SubscriptionInfo {
  id: string
  platformProjectName: string
  githubRepoFullName: string | null
  autoFixEnabled: boolean
  maxFixAttempts: number
  notifyOnFix: boolean
  fixBranchPrefix: string | null
}

interface TaskInfo {
  id: string
  status: string
  progress: number | null
  prUrl: string | null
  sandboxUrl: string | null
}

interface DeploymentDetailResponse {
  deployment: DeploymentDetail
  subscription: SubscriptionInfo
  task: TaskInfo | null
  matchedRule: {
    id: string
    name: string
    skipFix: boolean
    customPrompt: string | null
  } | null
}

const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  typescript: 'TypeScript Error',
  dependency: 'Dependency Error',
  config: 'Configuration Error',
  runtime: 'Runtime Error',
  build: 'Build Error',
  other: 'Other Error',
}

export function DeploymentDetail({ deploymentId }: DeploymentDetailProps) {
  const [data, setData] = useState<DeploymentDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggeringFix, setTriggeringFix] = useState(false)

  useEffect(() => {
    async function fetchDeployment() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/deployments/${deploymentId}`)
        if (!res.ok) {
          throw new Error('Failed to fetch deployment')
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('Failed to load deployment details')
      } finally {
        setLoading(false)
      }
    }

    fetchDeployment()
  }, [deploymentId])

  const handleTriggerFix = async () => {
    if (!data) return

    setTriggeringFix(true)
    try {
      const res = await fetch('/api/deployments/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to trigger fix')
      }

      const res2 = await fetch(`/api/deployments/${deploymentId}`)
      if (res2.ok) {
        setData(await res2.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger fix')
    } finally {
      setTriggeringFix(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive">
        <AlertCircle className="size-5" />
        <span>{error || 'Deployment not found'}</span>
      </div>
    )
  }

  const { deployment, subscription, task, matchedRule } = data
  const canTriggerFix = ['failed', 'skipped'].includes(deployment.fixStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{subscription.platformProjectName}</h2>
          {subscription.githubRepoFullName && (
            <p className="text-muted-foreground">{subscription.githubRepoFullName}</p>
          )}
        </div>
        <FixStatusBadge status={deployment.fixStatus} />
      </div>

      {deployment.errorType && (
        <div className="p-4 border rounded-lg bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-4 text-destructive" />
            <span className="font-medium text-destructive">{ERROR_TYPE_LABELS[deployment.errorType]}</span>
          </div>
          {deployment.errorMessage && (
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap overflow-x-auto">
              {deployment.errorMessage}
            </pre>
          )}
        </div>
      )}

      {deployment.errorContext && (
        <div>
          <h3 className="text-sm font-medium mb-2">Error Context</h3>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {deployment.errorContext}
          </pre>
        </div>
      )}

      {matchedRule && (
        <div className="p-3 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Matched Rule:</span>
            <span>{matchedRule.name}</span>
            {matchedRule.skipFix && <span className="text-xs text-muted-foreground">(Skip fix enabled)</span>}
          </div>
        </div>
      )}

      {deployment.fixSummary && (
        <div>
          <h3 className="text-sm font-medium mb-2">Fix Summary</h3>
          <p className="text-sm text-muted-foreground">{deployment.fixSummary}</p>
        </div>
      )}

      {deployment.prUrl && (
        <div className="flex items-center gap-3">
          <a
            href={deployment.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <GitBranch className="size-4" />
            View Pull Request {deployment.prNumber && `#${deployment.prNumber}`}
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {task && (
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Fix Progress</h3>
            <span className="text-xs text-muted-foreground capitalize">{task.status}</span>
          </div>
          {task.progress !== null && (
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
            </div>
          )}
          {task.sandboxUrl && (
            <a
              href={task.sandboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View Sandbox
            </a>
          )}
        </div>
      )}

      {deployment.logs && (
        <div>
          <h3 className="text-sm font-medium mb-2">Logs</h3>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap">
            {deployment.logs}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="size-4" />
          Created {new Date(deployment.createdAt).toLocaleString()}
        </div>
        {deployment.fixAttemptNumber && deployment.fixAttemptNumber > 1 && (
          <span>Attempt {deployment.fixAttemptNumber}</span>
        )}
      </div>

      {canTriggerFix && (
        <Button onClick={handleTriggerFix} disabled={triggeringFix}>
          {triggeringFix ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Triggering...
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Trigger Manual Fix
            </>
          )}
        </Button>
      )}
    </div>
  )
}
