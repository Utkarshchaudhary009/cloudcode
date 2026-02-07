'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertTriangle, Info, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const getSeverityIcon = () => {
    switch (finding.severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getSeverityColor = () => {
    switch (finding.severity) {
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      case 'info':
        return 'outline'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {getSeverityIcon()}
            <Badge variant={getSeverityColor()} className="uppercase">
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
