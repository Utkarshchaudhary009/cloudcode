'use client'

import { Badge } from '@/components/ui/badge'
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { FixStatus } from '@/lib/integrations/types'

interface FixStatusBadgeProps {
  status: FixStatus
}

const STATUS_CONFIG: Record<
  FixStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
    className?: string
  }
> = {
  pending: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  analyzing: {
    label: 'Analyzing',
    variant: 'secondary',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  fixing: {
    label: 'Fixing',
    variant: 'secondary',
    icon: Loader2,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
  reviewing: {
    label: 'Reviewing',
    variant: 'secondary',
    icon: Loader2,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  pr_created: {
    label: 'PR Created',
    variant: 'default',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  merged: {
    label: 'Merged',
    variant: 'default',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: AlertCircle,
  },
  skipped: {
    label: 'Skipped',
    variant: 'outline',
    icon: AlertCircle,
  },
}

export function FixStatusBadge({ status }: FixStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon
        className={`size-3 ${status === 'analyzing' || status === 'fixing' || status === 'reviewing' ? 'animate-spin' : ''}`}
      />
      {config.label}
    </Badge>
  )
}
