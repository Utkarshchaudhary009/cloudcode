import { RepoLayout } from '@/components/repo-layout'
import { Metadata } from 'next'

interface LayoutPageProps {
  params: Promise<{
    owner: string
    repo: string
  }>
  children: React.ReactNode
}

export default async function Layout({ params, children }: LayoutPageProps) {
  const { owner, repo } = await params

  return (
    <RepoLayout owner={owner} repo={repo}>
      {children}
    </RepoLayout>
  )
}

export async function generateMetadata({ params }: LayoutPageProps): Promise<Metadata> {
  const { owner, repo } = await params

  return {
    title: `${owner}/${repo} - CloudCode`,
    description: 'View repository commits, issues, and pull requests',
  }
}
