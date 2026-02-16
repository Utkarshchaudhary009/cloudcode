import { Metadata } from 'next'
import { IntegrationsList } from './integrations-list'

export const metadata: Metadata = {
  title: 'Integrations | Cloudcode',
  description: 'Connect your deployment platforms for automatic error fixing',
}

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">Connect your deployment platforms for automatic error fixing</p>
      </div>

      <IntegrationsList />
    </div>
  )
}
