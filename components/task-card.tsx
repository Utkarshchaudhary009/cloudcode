'use client'

import { Task } from '@/lib/db/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { StatusBadge, StatusDot } from '@/components/status-badge'
import { PRStatusIcon } from '@/components/pr-status-icon'
import { PRCheckStatus } from '@/components/pr-check-status'
import { useModelsDevCatalog } from '@/lib/hooks/use-models-dev'
import { OpenCode } from '@/components/logos'
import { Clock } from 'lucide-react'

interface TaskCardProps {
  task: Task
  isSelected?: boolean
  onSelect?: (taskId: string) => void
  onClick?: () => void
  showCheckbox?: boolean
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - new Date(date).getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes === 1) return '1 minute ago'
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
  if (diffInHours === 1) return '1 hour ago'
  if (diffInHours < 24) return `${diffInHours} hours ago`
  if (diffInDays === 1) return 'yesterday'
  if (diffInDays < 7) return `${diffInDays} days ago`
  return new Date(date).toLocaleDateString()
}

export function TaskCard({ task, isSelected = false, onSelect, onClick, showCheckbox = true }: TaskCardProps) {
  const { getProviderLabel } = useModelsDevCatalog()

  return (
    <Card
      className={cn(
        'transition-colors hover:bg-accent cursor-pointer p-0',
        isSelected && 'ring-2 ring-primary',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return
        }
        onClick?.()
      }}
    >
      <CardContent className="px-4 py-3">
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect?.(task.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={task.status} />
              <h3 className="text-sm font-medium truncate flex-1">{task.title || task.prompt}</h3>
              <StatusBadge status={task.status} size="sm" showDot={false} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {task.repoUrl && (
                <div className="flex items-center gap-1">
                  {task.prStatus && (
                    <div className="relative">
                      <PRStatusIcon status={task.prStatus} />
                      <PRCheckStatus taskId={task.id} prStatus={task.prStatus} />
                    </div>
                  )}
                  <span className="truncate max-w-[180px]">
                    {(() => {
                      try {
                        const url = new URL(task.repoUrl)
                        const pathParts = url.pathname.split('/').filter(Boolean)
                        if (pathParts.length >= 2) {
                          return `${pathParts[0]}/${pathParts[1].replace(/\.git$/, '')}`
                        }
                        return 'Unknown'
                      } catch {
                        return 'Unknown'
                      }
                    })()}
                  </span>
                </div>
              )}
              {task.selectedProvider && (
                <div className="flex items-center gap-1">
                  <OpenCode className="w-3 h-3" />
                  <span>{getProviderLabel(task.selectedProvider)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{getTimeAgo(task.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
