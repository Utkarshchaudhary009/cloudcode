'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import type { FixStatus } from '@/lib/integrations/types'

interface Deployment {
  id: string
  platformDeploymentId: string
  fixStatus: FixStatus
  errorType: string | null
  errorMessage: string | null
  prUrl: string | null
  createdAt: string
  githubRepoFullName: string
  platformProjectName: string
}

const STATUS_CONFIG: Record<
  FixStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  pending: { label: 'Pending', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  analyzing: { label: 'Analyzing', variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  fixing: { label: 'Fixing', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  reviewing: { label: 'Reviewing', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  pr_created: { label: 'PR Created', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  merged: { label: 'Merged', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  skipped: { label: 'Skipped', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
}

export function DeploymentsDashboard() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDeployments() {
      try {
        const res = await fetch('/api/deployments')
        const data = await res.json()
        setDeployments(data.deployments || [])
      } catch {
        // Handle error
      } finally {
        setLoading(false)
      }
    }

    fetchDeployments()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (deployments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 sm:py-12 text-center text-sm sm:text-base text-muted-foreground">
          No deployments found. Connect a deployment platform to get started.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{deployments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {deployments.filter((d) => ['pending', 'analyzing', 'fixing', 'reviewing'].includes(d.fixStatus)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Fixed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {deployments.filter((d) => ['pr_created', 'merged'].includes(d.fixStatus)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-destructive">
              {deployments.filter((d) => d.fixStatus === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Recent Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {deployments.map((deployment) => {
              const statusConfig = STATUS_CONFIG[deployment.fixStatus]
              return (
                <div
                  key={deployment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b pb-3 sm:pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm sm:text-base truncate">
                        {deployment.platformProjectName}
                      </span>
                      <Badge variant={statusConfig.variant} className="gap-1 text-xs">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground truncate">
                      {deployment.githubRepoFullName} • {deployment.errorType || 'Unknown error'}
                    </div>
                    {deployment.errorMessage && (
                      <div className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
                        {deployment.errorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {deployment.prUrl && (
                      <a
                        href={deployment.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View PR <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
