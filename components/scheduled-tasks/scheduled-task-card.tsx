'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { Clock, Calendar, Play, Edit, Trash2 } from 'lucide-react'

interface ScheduledTaskCardProps {
  task: any
  onEdit?: () => void
  onDelete?: () => void
  onToggleEnabled?: () => void
}

export function ScheduledTaskCard({ task, onEdit, onDelete, onToggleEnabled }: ScheduledTaskCardProps) {
  const router = useRouter()

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      bug_finder: 'bg-error/10 text-error border-error/20',
      ui_review: 'bg-info/10 text-info border-info/20',
      security_scan: 'bg-error/10 text-error border-error/20',
      code_quality: 'bg-success/10 text-success border-success/20',
      performance_audit: 'bg-warning/10 text-warning border-warning/20',
      custom: 'bg-muted text-muted-foreground',
    }
    return colors[type] || 'bg-muted text-muted-foreground'
  }

  const formatTaskType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const formatDays = (days: string[]) => {
    if (days.includes('daily')) return 'Daily'
    return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
  }

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {task.name}
              {task.enabled ? (
                <Badge className="text-[10px] bg-success/10 text-success border-success/20">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] opacity-60">
                  Paused
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{task.repoUrl}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={task.enabled} onCheckedChange={onToggleEnabled} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={`text-[10px] border ${getTaskTypeColor(task.taskType)}`}>
            {formatTaskType(task.taskType)}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.timeSlot}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDays(task.days)}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{task.prompt}</p>

        {task.lastRunAt && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>
            {task.lastRunStatus && (
              <Badge
                className={`text-[10px] ${task.lastRunStatus === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}
              >
                {task.lastRunStatus === 'success' ? '✓ Success' : '✗ Failed'}
              </Badge>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/tasks/${task.lastRunTaskId}`)}>
            <Play className="h-4 w-4 mr-1" />
            Run Now
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
