import { XCircle, AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export type Severity = 'error' | 'warning' | 'info'

export type BadgeVariant = 'destructive' | 'secondary' | 'outline' | 'default'

export function getSeverityColor(severity: string): BadgeVariant {
  switch (severity) {
    case 'error':
      return 'destructive'
    case 'warning':
      return 'secondary'
    case 'info':
      return 'outline'
    default:
      return 'outline'
  }
}

export function getSeverityIcon(severity: string): ReactNode {
  switch (severity) {
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'info':
      return <Info className="h-4 w-4 text-blue-600" />
    default:
      return null
  }
}

export function getStatusIcon(status: string): ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'in_progress':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />
    default:
      return null
  }
}

export function getStatusColor(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'default'
    case 'in_progress':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'outline'
  }
}
