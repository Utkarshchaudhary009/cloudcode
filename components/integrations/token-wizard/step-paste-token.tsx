'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface StepPasteTokenProps {
  token: string
  onChange: (value: string) => void
  error: string | null
  loading: boolean
  progressMessage: string | null
  onConnect: () => void
  onBack?: () => void
}

export function StepPasteToken({
  token,
  onChange,
  error,
  loading,
  progressMessage,
  onConnect,
  onBack,
}: StepPasteTokenProps) {
  const isValidFormat = token.length > 10

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Paste Your Token</h3>
        <p className="text-sm text-muted-foreground mt-2">Copy the token you just created and paste it below.</p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Input
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste your API token here"
            className="font-mono pr-10"
            autoFocus
            type="password"
          />
          {isValidFormat && !error && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {progressMessage && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progressMessage}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        {onBack && (
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <Button onClick={onConnect} disabled={!token || !isValidFormat || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    </div>
  )
}
