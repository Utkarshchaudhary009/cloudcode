import { RepoDeployments } from '@/components/repo-deployments'

interface DeploymentsPageProps {
  params: Promise<{
    owner: string
    repo: string
  }>
}

export default async function DeploymentsPage({ params }: DeploymentsPageProps) {
  const { owner, repo } = await params

  return <RepoDeployments owner={owner} repo={repo} />
}
