'use client'

import { Button } from '@/components/ui/button'
import type { DeploymentProvider } from '@/lib/integrations/types'

interface StepIntroductionProps {
  provider: DeploymentProvider
  onContinue: () => void
}

const PROVIDER_INFO: Record<DeploymentProvider, { name: string; description: string }> = {
  vercel: {
    name: 'Vercel',
    description: 'Connect your Vercel account to monitor deployments and automatically fix build errors.',
  },
  cloudflare: {
    name: 'Cloudflare',
    description: 'Connect your Cloudflare account to monitor deployments and automatically fix build errors.',
  },
  render: {
    name: 'Render',
    description: 'Connect your Render account to monitor deployments and automatically fix build errors.',
  },
}

export function StepIntroduction({ provider, onContinue }: StepIntroductionProps) {
  const info = PROVIDER_INFO[provider]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Connect to {info.name}</h3>
        <p className="text-sm text-muted-foreground mt-2">{info.description}</p>
      </div>

      <div className="bg-muted rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">What you will need:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>An API token from {info.name}</li>
          <li>Permission to create tokens in your account</li>
          <li>A few minutes to complete the setup</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </div>
  )
}
