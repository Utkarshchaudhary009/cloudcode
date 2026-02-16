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
        <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">{name}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {connected ? 'Monitor and auto-fix deployments' : 'Connect to get started'}
            </CardDescription>
          </div>
          <Badge
            variant={connected ? 'secondary' : 'outline'}
            className={`gap-1 text-xs flex-shrink-0 ${connected ? 'text-green-600 dark:text-green-400' : ''}`}
          >
            {connected && <CheckCircle2 className="h-3 w-3" />}
            {connected ? 'Connected' : 'Not connected'}
          </Badge>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">as</span>
                <span className="font-medium truncate">@{username}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)} className="flex-1 sm:flex-none">
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="sm:hidden">Reconnect</span>
                  <span className="hidden sm:inline">Reconnect</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={onDisconnect} className="flex-1 sm:flex-none">
                  <Unplug className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="sm:hidden">Disconnect</span>
                  <span className="hidden sm:inline">Disconnect</span>
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
