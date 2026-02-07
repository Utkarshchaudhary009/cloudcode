'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewScoreBadgeProps {
  score: number | null
}

export function ReviewScoreBadge({ score }: ReviewScoreBadgeProps) {
  if (score === null) return null

  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-300'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  return (
    <Badge variant="outline" className={cn('flex items-center gap-1 font-semibold', getColor(score))}>
      Score: {score}/100
    </Badge>
  )
}
