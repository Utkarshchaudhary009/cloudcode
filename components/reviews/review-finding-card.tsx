'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
import { getSeverityIcon, getSeverityColor } from '@/lib/utils/review'

interface ReviewFindingCardProps {
  finding: {
    file: string
    line?: number
    severity: 'error' | 'warning' | 'info'
    message: string
    suggestion?: string
  }
}

export function ReviewFindingCard({ finding }: ReviewFindingCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {getSeverityIcon(finding.severity)}
            <Badge variant={getSeverityColor(finding.severity)} className="uppercase">
              {finding.severity}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            {finding.file}
            {finding.line && `:${finding.line}`}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{finding.message}</p>
        {finding.suggestion && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Suggestion</p>
            <p className="text-sm">{finding.suggestion}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
