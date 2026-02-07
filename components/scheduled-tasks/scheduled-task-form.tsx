'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TimeSlotPicker } from './time-slot-picker'
import { DayPicker } from './day-picker'
import { useRouter } from 'next/navigation'

interface ScheduledTaskFormProps {
  task?: any
  taskId?: string
  onSuccess?: () => void
}

export function ScheduledTaskForm({ task: initialTask, taskId, onSuccess }: ScheduledTaskFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetchingTask, setFetchingTask] = useState(!!taskId && !initialTask)
  const [task, setTask] = useState(initialTask)
  const [formData, setFormData] = useState({
    name: initialTask?.name || '',
    repoUrl: initialTask?.repoUrl || '',
    prompt: initialTask?.prompt || '',
    taskType: initialTask?.taskType || 'custom',
    timeSlot: initialTask?.timeSlot || '9am',
    days: initialTask?.days || ['daily'],
    timezone: initialTask?.timezone || 'UTC',
    selectedAgent: initialTask?.selectedAgent || 'openai',
    selectedModel: initialTask?.selectedModel || '',
    enabled: initialTask?.enabled ?? true,
  })

  useEffect(() => {
    if (taskId && !initialTask) {
      fetchTask()
    }
  }, [taskId])

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${taskId}`)
      if (!response.ok) throw new Error('Task not found')
      const data = await response.json()
      setTask(data.task)
      setFormData({
        name: data.task.name || '',
        repoUrl: data.task.repoUrl || '',
        prompt: data.task.prompt || '',
        taskType: data.task.taskType || 'custom',
        timeSlot: data.task.timeSlot || '9am',
        days: data.task.days || ['daily'],
        timezone: data.task.timezone || 'UTC',
        selectedAgent: data.task.selectedAgent || 'openai',
        selectedModel: data.task.selectedModel || '',
        enabled: data.task.enabled ?? true,
      })
    } catch (error) {
      console.error('Error fetching task:', error)
    } finally {
      setFetchingTask(false)
    }
  }

  if (fetchingTask) {
    return <div className="flex items-center justify-center h-32">Loading...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const id = task?.id || taskId
    try {
      const url = id ? `/api/scheduled-tasks/${id}` : '/api/scheduled-tasks'
      const method = id ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save task')

      onSuccess?.()
      if (!task) {
        router.push('/scheduled-tasks')
      }
    } catch (error) {
      console.error('Error saving task:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My scheduled task"
            required
          />
        </div>

        <div>
          <Label htmlFor="repoUrl">Repository URL</Label>
          <Input
            id="repoUrl"
            value={formData.repoUrl}
            onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
            placeholder="https://github.com/owner/repo"
            required
          />
        </div>

        <div>
          <Label htmlFor="taskType">Task Type</Label>
          <Select value={formData.taskType} onValueChange={(value) => setFormData({ ...formData, taskType: value })}>
            <SelectTrigger id="taskType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug_finder">Bug Finder</SelectItem>
              <SelectItem value="ui_review">UI Review</SelectItem>
              <SelectItem value="security_scan">Security Scan</SelectItem>
              <SelectItem value="code_quality">Code Quality</SelectItem>
              <SelectItem value="performance_audit">Performance Audit</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            placeholder="Describe what the task should do..."
            rows={4}
            required
          />
        </div>

        <div>
          <Label>Time Slot</Label>
          <TimeSlotPicker
            value={formData.timeSlot}
            onChange={(value) => setFormData({ ...formData, timeSlot: value })}
          />
        </div>

        <div>
          <Label>Days</Label>
          <DayPicker value={formData.days} onChange={(value) => setFormData({ ...formData, days: value })} />
        </div>

        <div>
          <Label htmlFor="selectedAgent">AI Agent</Label>
          <Select
            value={formData.selectedAgent}
            onValueChange={(value) => setFormData({ ...formData, selectedAgent: value })}
          >
            <SelectTrigger id="selectedAgent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="vercel">Vercel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="enabled"
            checked={formData.enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
          />
          <Label htmlFor="enabled">Enabled</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : task || taskId ? 'Update' : 'Create'} Task
        </Button>
      </div>
    </form>
  )
}
