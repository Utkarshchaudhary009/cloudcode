'use client'

import { useEffect, useState } from 'react'
import { Rocket, Loader2 } from 'lucide-react'
import { DeploymentRow } from '@/components/deployments/shared/deployment-row'
import type { FixStatus, ErrorType } from '@/lib/integrations/types'

interface Deployment {
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

interface RepoDeploymentsProps {
  owner: string
  repo: string
}

export function RepoDeployments({ owner, repo }: RepoDeploymentsProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDeployments() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/deployments?repo=${encodeURIComponent(`${owner}/${repo}`)}`)
        if (!response.ok) {
          throw new Error('Failed to fetch deployments')
        }
        const data = await response.json()
        setDeployments(data.deployments || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deployments')
      } finally {
        setLoading(false)
      }
    }

    fetchDeployments()
  }, [owner, repo])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading deployments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Error Loading Deployments</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (deployments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Deployments Found</h3>
          <p className="text-sm text-muted-foreground">No deployments have been recorded for this repository yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-6">
      {deployments.map((deployment) => (
        <DeploymentRow key={deployment.id} deployment={deployment} />
      ))}
    </div>
  )
}
