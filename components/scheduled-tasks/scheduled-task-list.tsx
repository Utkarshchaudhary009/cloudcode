'use client'

import { useEffect, useState } from 'react'
import { ScheduledTaskCard } from './scheduled-task-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ScheduledTaskForm } from './scheduled-task-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ScheduledTaskList() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/scheduled-tasks')
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await fetch(`/api/scheduled-tasks/${taskId}`, { method: 'DELETE' })
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleToggleEnabled = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      await fetch(`/api/scheduled-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !task.enabled }),
      })
      fetchTasks()
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Tasks</h1>
          <p className="text-muted-foreground">Manage your recurring automated tasks</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Scheduled Task</DialogTitle>
              <DialogDescription>Configure an automated task to run at specific time slots</DialogDescription>
            </DialogHeader>
            <ScheduledTaskForm
              onSuccess={() => {
                setShowCreateDialog(false)
                fetchTasks()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {editingTask && (
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Scheduled Task</DialogTitle>
              <DialogDescription>Modify your scheduled task configuration</DialogDescription>
            </DialogHeader>
            <ScheduledTaskForm
              task={editingTask}
              onSuccess={() => {
                setEditingTask(null)
                fetchTasks()
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No scheduled tasks yet</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <ScheduledTaskCard
              key={task.id}
              task={task}
              onEdit={() => setEditingTask(task)}
              onDelete={() => handleDelete(task.id)}
              onToggleEnabled={() => handleToggleEnabled(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
