'use client'

import { DeploymentsTab } from '@/components/deployments/minimal/deployments-tab'

interface RepoDeploymentsProps {
  owner: string
  repo: string
}

export function RepoDeployments({ owner, repo }: RepoDeploymentsProps) {
  return <DeploymentsTab repoFullName={`${owner}/${repo}`} />
}
