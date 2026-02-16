'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Unplug, RefreshCw, CheckCircle2 } from 'lucide-react'
import { TokenWizardModal } from './token-wizard/token-wizard-modal'
import type { DeploymentProvider } from '@/lib/integrations/types'

interface ConnectionCardProps {
  provider: DeploymentProvider
  name: string
  connected: boolean
  username?: string
  onDisconnect?: () => void
  onReconnect?: () => void
}

export function ConnectionCard({
  provider,
  name,
  connected,
  username,
  onDisconnect,
  onReconnect,
}: ConnectionCardProps) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <CardDescription>
              {connected ? 'Monitor and auto-fix deployments' : 'Connect to get started'}
            </CardDescription>
          </div>
          {connected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">as</span>
                <span className="font-medium">@{username}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm" onClick={onDisconnect}>
                  <Unplug className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setWizardOpen(true)} className="w-full">
              Connect {name}
            </Button>
          )}
        </CardContent>
      </Card>

      <TokenWizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        provider={provider}
        onSuccess={() => {
          onReconnect?.()
        }}
      />
    </>
  )
}
