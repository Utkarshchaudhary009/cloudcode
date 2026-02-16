'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import VercelIcon from '@/components/icons/vercel-icon'

interface ProjectRowProps {
  projectId: string
  projectName: string
  githubRepo: string | null
  hasGitLink: boolean
  isMonitored: boolean
  subscriptionId?: string
  onToggle: (enabled: boolean) => Promise<void>
  externalUrl: string
}

export function ProjectRow({
  projectId,
  projectName,
  githubRepo,
  hasGitLink,
  isMonitored,
  subscriptionId,
  onToggle,
  externalUrl,
}: ProjectRowProps) {
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(isMonitored)

  const handleToggle = async (enabled: boolean) => {
    setLoading(true)
    try {
      await onToggle(enabled)
      setChecked(enabled)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 border-b last:border-0">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <VercelIcon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm sm:text-base truncate">{projectName}</div>
          {githubRepo ? (
            <div className="text-xs sm:text-sm text-muted-foreground truncate">{githubRepo}</div>
          ) : (
            <div className="text-xs sm:text-sm text-muted-foreground">No GitHub repo linked</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasGitLink ? (
            <Switch checked={checked} onCheckedChange={handleToggle} disabled={loading} />
          ) : (
            <span className="text-xs text-muted-foreground">No Git</span>
          )}
          <span
            className={`text-xs sm:text-sm ${checked ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}`}
          >
            {checked ? 'Monitoring' : 'Disabled'}
          </span>
        </div>

        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
