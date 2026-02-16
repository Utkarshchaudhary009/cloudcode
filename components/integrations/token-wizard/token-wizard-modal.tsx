'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WizardProgress } from './wizard-progress'
import { StepIntroduction } from './step-introduction'
import { StepCreateToken } from './step-create-token'
import { StepPasteToken } from './step-paste-token'
import { StepVerify } from './step-verify'
import type { DeploymentProvider } from '@/lib/integrations/types'

interface TokenWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: DeploymentProvider
  onSuccess?: (username: string) => void
}

const STEPS = ['Intro', 'Create', 'Connect', 'Done']

interface Team {
  id: string
  name: string
  slug: string
}

interface StreamMessage {
  type: string
  message?: string
  valid?: boolean
  username?: string
  projectCount?: number
  error?: string
  teams?: Team[]
}

async function readStreamResponse(
  response: Response,
  onProgress: (message: string) => void,
): Promise<StreamMessage | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const decoder = new TextDecoder()
  let buffer = ''
  let lastMessage: StreamMessage | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const message = JSON.parse(line) as StreamMessage
        lastMessage = message
        if (message.type === 'progress' && message.message) {
          onProgress(message.message)
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return lastMessage
}

export function TokenWizardModal({ open, onOpenChange, provider, onSuccess }: TokenWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [token, setToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [connecting, setConnecting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null)

  const handlePaste = async () => {
    setVerifying(true)
    setError(null)
    setProgressMessage(null)

    try {
      const res = await fetch(`/api/integrations/${provider}/token/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const result = await readStreamResponse(res, setProgressMessage)

      if (!result || result.type === 'error') {
        setError(result?.error || 'Invalid token')
        setVerifying(false)
        return
      }

      if (!result.valid) {
        setError('Invalid token')
        setVerifying(false)
        return
      }

      setUsername(result.username || null)
      setTeams(result.teams || [])
      setIsVerified(true) // Show the dropdown on the same screen
    } catch {
      setError('Failed to verify token')
    } finally {
      setVerifying(false)
      setProgressMessage(null)
    }
  }

  const handleFinalConnect = async () => {
    setConnecting(true)
    setError(null)

    try {
      const saveRes = await fetch(`/api/integrations/${provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          teamId: selectedTeamId,
          teamSlug: selectedTeamSlug,
        }),
      })
      const saveData = await saveRes.json()

      if (!saveData.success) {
        setError(saveData.error || 'Failed to save token')
        return
      }

      setCurrentStep(3) // Move to "Done" (StepVerify)
      onSuccess?.(username || '')
    } catch {
      setError('Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleDone = () => {
    onOpenChange(false)
    setCurrentStep(0)
    setToken('')
    setUsername(null)
    setError(null)
    setProgressMessage(null)
    setTeams([])
    setIsVerified(false)
    setSelectedTeamId(null)
    setSelectedTeamSlug(null)
  }

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[calc(100vw-2rem)] sm:!max-w-[90vw] md:!max-w-[800px] lg:!max-w-[900px] max-h-[95vh] overflow-y-auto p-4 sm:p-6 lg:p-8">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl">Connect to {providerName}</DialogTitle>
        </DialogHeader>

        <WizardProgress steps={STEPS} currentStep={currentStep} />

        <div className="mt-4 sm:mt-6 lg:mt-8">
          {currentStep === 0 && <StepIntroduction provider={provider} onContinue={() => setCurrentStep(1)} />}
          {currentStep === 1 && (
            <StepCreateToken
              provider={provider}
              onContinue={() => setCurrentStep(2)}
              onBack={() => setCurrentStep(0)}
            />
          )}
          {currentStep === 2 && (
            <StepPasteToken
              token={token}
              onChange={setToken}
              error={error}
              loading={verifying || connecting}
              progressMessage={progressMessage}
              onConnect={handlePaste}
              onBack={() => {
                if (isVerified) {
                  setIsVerified(false)
                } else {
                  setCurrentStep(1)
                }
              }}
              teams={teams}
              selectedTeamId={selectedTeamId}
              onScopeChange={(id, slug) => {
                setSelectedTeamId(id)
                setSelectedTeamSlug(slug)
              }}
              isVerified={isVerified}
              onFinalConnect={handleFinalConnect}
            />
          )}
          {currentStep === 3 && <StepVerify username={username} onDone={handleDone} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
