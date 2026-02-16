'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { DeploymentProvider } from '@/lib/integrations/types'
import { getProviderMetadata } from '@/lib/integrations/metadata'

interface StepCreateTokenProps {
  provider: DeploymentProvider
  onContinue: () => void
  onBack?: () => void
}

export function StepCreateToken({ provider, onContinue, onBack }: StepCreateTokenProps) {
  const info = getProviderMetadata(provider)

  if (!info) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Provider Not Available</h3>
          <p className="text-sm text-muted-foreground mt-2">This provider is not yet implemented.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onContinue} variant="outline">
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Create an API Token</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Click the button below to create a new API token for {info.name}.
        </p>
      </div>

      <div className="flex justify-center">
        <Button asChild size="lg">
          <a href={info.tokenCreateUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Create {info.name} Token
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
            Grant <strong>{info.tokenNote}</strong> access
          </li>
          <li>Set an expiration (or none for permanent)</li>
          <li>Copy the token - you will not see it again!</li>
        </ul>
      </div>

      <div className="flex justify-between">
        {onBack && (
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <Button onClick={onContinue} variant="outline">
          I have created the token
        </Button>
      </div>
    </div>
  )
}
