'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import type { DeploymentProvider } from '@/lib/integrations/types'

interface StepCreateTokenProps {
  provider: DeploymentProvider
  onContinue: () => void
}

const PROVIDER_LINKS: Record<DeploymentProvider, string> = {
  vercel: 'https://vercel.com/account/tokens/new?name=Cloudcode-AutoFix',
  cloudflare: 'https://dash.cloudflare.com/profile/api-tokens',
  render: 'https://dashboard.render.com/api-keys',
}

const PROVIDER_INSTRUCTIONS: Record<DeploymentProvider, { name: string; note: string }> = {
  vercel: {
    name: 'Vercel',
    note: 'Full Account',
  },
  cloudflare: {
    name: 'Cloudflare',
    note: 'Edit Cloudflare Workers',
  },
  render: {
    name: 'Render',
    note: 'Read/Write access',
  },
}

export function StepCreateToken({ provider, onContinue }: StepCreateTokenProps) {
  const createUrl = PROVIDER_LINKS[provider]
  const instructions = PROVIDER_INSTRUCTIONS[provider]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Create an API Token</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Click the button below to create a new API token for {instructions.name}.
        </p>
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <a href={createUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Create {instructions.name} Token
          </a>
        </Button>
      </div>

      <div className="bg-muted rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">When creating your token:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            Name it something like <code className="bg-background px-1 rounded">Cloudcode-AutoFix</code>
          </li>
          <li>
            Grant <strong>{instructions.note}</strong> access
          </li>
          <li>Set an expiration (or none for permanent)</li>
          <li>Copy the token - you won't see it again!</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} variant="outline">
          I have created the token
        </Button>
      </div>
    </div>
  )
}
