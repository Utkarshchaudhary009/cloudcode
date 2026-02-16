import { Metadata } from 'next'
import { DeploymentDetail } from '@/components/deployments/dashboard/deployment-detail'

interface DeploymentPageProps {
  params: Promise<{
    id: string
  }>
}

export const metadata: Metadata = {
  title: 'Deployment Details | Cloudcode',
  description: 'View deployment details and fix status',
}

export default async function DeploymentPage({ params }: DeploymentPageProps) {
  const { id } = await params

  return (
    <div className="flex-1 bg-background">
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <DeploymentDetail deploymentId={id} />
      </div>
    </div>
  )
}
