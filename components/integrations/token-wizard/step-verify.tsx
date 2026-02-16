'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

interface StepVerifyProps {
  username: string | null
  onDone: () => void
}

export function StepVerify({ username, onDone }: StepVerifyProps) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Successfully Connected!</h3>
        <p className="text-sm text-muted-foreground mt-2">Connected to {username ? `@${username}` : 'your account'}</p>
      </div>

      <Button onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  )
}
