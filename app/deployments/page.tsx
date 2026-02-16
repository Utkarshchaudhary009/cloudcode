import { Metadata } from 'next'
import { DeploymentsDashboard } from './deployments-dashboard'

export const metadata: Metadata = {
  title: 'Deployments | Cloudcode',
  description: 'Monitor deployments and auto-fix failures',
}

export default function DeploymentsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Deployments</h1>
        <p className="text-muted-foreground mt-2">Monitor deployments and auto-fix failures</p>
      </div>

      <DeploymentsDashboard />
    </div>
  )
}
