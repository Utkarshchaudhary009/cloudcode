'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardProgressProps {
  steps: string[]
  currentStep: number
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center sm:justify-between px-2 sm:px-0">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
              index < currentStep
                ? 'bg-primary text-primary-foreground'
                : index === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <span
            className={cn(
              'ml-2 text-sm hidden md:inline',
              index === currentStep ? 'font-medium' : 'text-muted-foreground',
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div className={cn('mx-4 h-0.5 w-8 lg:w-16', index < currentStep ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  )
}
