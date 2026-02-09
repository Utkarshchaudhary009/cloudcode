'use client'

import { useState, useEffect, useMemo } from 'react'
import { Task } from '@/lib/db/schema'
import { useTasks } from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2, StopCircle, X, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { OpenCode } from '@/components/logos'
import { PRStatusIcon } from '@/components/pr-status-icon'
import { PRCheckStatus } from '@/components/pr-check-status'
import { useModelsDevCatalog } from '@/lib/hooks/use-models-dev'
import { StatusBadge, StatusDot } from '@/components/status-badge'

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

export function TasksListClient() {
  const { refreshTasks } = useTasks()
  const router = useRouter()
  const { getProviderLabel, getModelLabel } = useModelsDevCatalog()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks
    return tasks.filter((task) => task.status === statusFilter)
  }, [tasks, statusFilter])

  // Group tasks by date for display
  const groupedTasks = useMemo(() => {
    const groups: { label: string; tasks: Task[] }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const todayTasks: Task[] = []
    const yesterdayTasks: Task[] = []
    const lastWeekTasks: Task[] = []
    const olderTasks: Task[] = []

    filteredTasks.forEach((task) => {
      const taskDate = new Date(task.createdAt)
      taskDate.setHours(0, 0, 0, 0)

      if (taskDate >= today) {
        todayTasks.push(task)
      } else if (taskDate >= yesterday) {
        yesterdayTasks.push(task)
      } else if (taskDate >= lastWeek) {
        lastWeekTasks.push(task)
      } else {
        olderTasks.push(task)
      }
    })

    if (todayTasks.length > 0) groups.push({ label: 'Today', tasks: todayTasks })
    if (yesterdayTasks.length > 0) groups.push({ label: 'Yesterday', tasks: yesterdayTasks })
    if (lastWeekTasks.length > 0) groups.push({ label: 'Last 7 Days', tasks: lastWeekTasks })
    if (olderTasks.length > 0) groups.push({ label: 'Older', tasks: olderTasks })

    return groups
  }, [filteredTasks])

  // Task counts by status
  const taskCounts = useMemo(() => {
    const counts = {
      all: tasks.length,
      processing: 0,
      completed: 0,
      error: 0,
      stopped: 0,
    }
    tasks.forEach((task) => {
      if (task.status in counts) {
        counts[task.status as keyof typeof counts]++
      }
    })
    return counts
  }, [tasks])

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredTasks.map((task) => task.id)))
    }
  }

  const handleSelectTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      const deletePromises = Array.from(selectedTasks).map((taskId) =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        }),
      )

      const results = await Promise.all(deletePromises)
      const successCount = results.filter((r) => r.ok).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} task${successCount > 1 ? 's' : ''}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} task${failCount > 1 ? 's' : ''}`)
      }

      setSelectedTasks(new Set())
      setShowDeleteDialog(false)
      await fetchTasks()
      await refreshTasks()
    } catch (error) {
      console.error('Error deleting tasks:', error)
      toast.error('Failed to delete tasks')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkStop = async () => {
    setIsStopping(true)
    try {
      const stopPromises = Array.from(selectedTasks)
        .filter((taskId) => {
          const task = tasks.find((t) => t.id === taskId)
          return task?.status === 'processing'
        })
        .map((taskId) =>
          fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' }),
          }),
        )

      if (stopPromises.length === 0) {
        toast.error('No running tasks selected')
        setShowStopDialog(false)
        setIsStopping(false)
        return
      }

      const results = await Promise.all(stopPromises)
      const successCount = results.filter((r) => r.ok).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        toast.success(`Successfully stopped ${successCount} task${successCount > 1 ? 's' : ''}`)
      }
      if (failCount > 0) {
        toast.error(`Failed to stop ${failCount} task${failCount > 1 ? 's' : ''}`)
      }

      setSelectedTasks(new Set())
      setShowStopDialog(false)
      await fetchTasks()
      await refreshTasks()
    } catch (error) {
      console.error('Error stopping tasks:', error)
      toast.error('Failed to stop tasks')
    } finally {
      setIsStopping(false)
    }
  }

  const getHumanFriendlyModelName = (provider: string | null, model: string | null) => {
    if (!provider || !model) return model
    return getModelLabel(provider, model)
  }

  const selectedProcessingTasks = Array.from(selectedTasks).filter((taskId) => {
    const task = tasks.find((t) => t.id === taskId)
    return task?.status === 'processing'
  })

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="max-w-4xl mx-auto">
          {/* Page Title & Tabs */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-4">Tasks</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: taskCounts.all },
                { key: 'processing', label: 'Running', count: taskCounts.processing },
                { key: 'completed', label: 'Completed', count: taskCounts.completed },
                { key: 'error', label: 'Failed', count: taskCounts.error },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    statusFilter === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-full text-xs',
                        statusFilter === tab.key
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background text-muted-foreground',
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions Toolbar */}
          {selectedTasks.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedTasks.size} selected</span>
              <div className="flex-1" />
              {selectedProcessingTasks.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowStopDialog(true)} disabled={isStopping}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTasks(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Tasks List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading tasks...</div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  {statusFilter === 'all' ? 'No tasks yet. Create your first task!' : `No ${statusFilter} tasks.`}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedTasks.map((group) => (
                <div key={group.label}>
                  {/* Date Group Header */}
                  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {group.label}
                  </h2>
                  <div className="space-y-2">
                    {group.tasks.map((task) => (
                      <Card
                        key={task.id}
                        className={cn(
                          'transition-colors hover:bg-accent cursor-pointer p-0',
                          selectedTasks.has(task.id) && 'ring-2 ring-primary',
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return
                          }
                          router.push(`/tasks/${task.id}`)
                        }}
                      >
                        <CardContent className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTasks.has(task.id)}
                              onCheckedChange={() => handleSelectTask(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />

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
                                {task.selectedAgent && (
                                  <div className="flex items-center gap-1">
                                    <OpenCode className="w-3 h-3" />
                                    <span>{getProviderLabel(task.selectedAgent)}</span>
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
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? 'Deleting...' : 'Delete Tasks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop Confirmation Dialog */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Running Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop {selectedProcessingTasks.length} running task
              {selectedProcessingTasks.length > 1 ? 's' : ''}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStop}
              disabled={isStopping}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isStopping ? 'Stopping...' : 'Stop Tasks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
