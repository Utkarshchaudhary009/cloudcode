import { Metadata } from 'next'
import { DeploymentsDashboard } from './deployments-dashboard'

export const metadata: Metadata = {
  title: 'Deployments | Cloudcode',
  description: 'Monitor deployments and auto-fix failures',
}

export default function DeploymentsPage() {
  return (
    <div className="flex-1 bg-background">
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Deployments</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Monitor deployments and auto-fix failures
          </p>
        </div>

        <DeploymentsDashboard />
      </div>
    </div>
  )
}
