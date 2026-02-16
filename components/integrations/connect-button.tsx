'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TokenWizardModal } from '@/components/integrations/token-wizard/token-wizard-modal'
import type { DeploymentProvider } from '@/lib/integrations/types'
import { getProviderMetadata } from '@/lib/integrations/metadata'

interface ConnectButtonProps {
  provider: DeploymentProvider
  onConnected?: (username: string) => void
}

export function ConnectButton({ provider, onConnected }: ConnectButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const info = getProviderMetadata(provider)

  if (!info) {
    return <Button disabled>Provider Not Available</Button>
  }

  return (
    <>
      <Button onClick={() => setModalOpen(true)}>Connect {info.name}</Button>

      <TokenWizardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        provider={provider}
        onSuccess={(username) => {
          onConnected?.(username)
        }}
      />
    </>
  )
}
