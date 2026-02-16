'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ManualFixButtonProps {
  deploymentId: string
  onFixTriggered?: () => void
}

export function ManualFixButton({ deploymentId, onFixTriggered }: ManualFixButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTriggerFix = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/deployments/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger fix')
      }

      onFixTriggered?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger fix')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button onClick={handleTriggerFix} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Triggering...
          </>
        ) : (
          <>
            <RefreshCw className="size-4" />
            Trigger Manual Fix
          </>
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
