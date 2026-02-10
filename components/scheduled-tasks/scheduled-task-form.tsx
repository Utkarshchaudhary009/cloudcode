'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TimeSlotPicker } from './time-slot-picker'
import { DayPicker } from './day-picker'
import { useRouter } from 'next/navigation'
import { RepoSelector } from '@/components/repo-selector'
import { API_KEY_PROVIDERS } from '@/lib/api-keys/providers'

interface ScheduledTaskFormProps {
  task?: any
  taskId?: string
  onSuccess?: () => void
}

// Get unique provider list for agent selection
const AI_PROVIDERS = API_KEY_PROVIDERS.map((p) => ({ id: p.id, name: p.name }))

export function ScheduledTaskForm({ task: initialTask, taskId, onSuccess }: ScheduledTaskFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetchingTask, setFetchingTask] = useState(!!taskId && !initialTask)
  const [task, setTask] = useState(initialTask)
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [formData, setFormData] = useState({
    name: initialTask?.name || '',
    repoUrl: initialTask?.repoUrl || '',
    prompt: initialTask?.prompt || '',
    taskType: initialTask?.taskType || 'custom',
    timeSlot: initialTask?.timeSlot || '9am',
    days: initialTask?.days || ['daily'],
    timezone: initialTask?.timezone || 'UTC',
    selectedProvider: initialTask?.selectedProvider || 'opencode',
    selectedModel: initialTask?.selectedModel || '',
    enabled: initialTask?.enabled ?? true,
  })

  // Parse existing repo URL to owner/repo
  useEffect(() => {
    if (formData.repoUrl) {
      const match = formData.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (match) {
        setSelectedOwner(match[1])
        setSelectedRepo(match[2].replace('.git', ''))
      }
    }
  }, [])

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
        selectedProvider: data.task.selectedProvider || 'opencode',
        selectedModel: data.task.selectedModel || '',
        enabled: data.task.enabled ?? true,
      })
      // Parse repo URL
      const match = data.task.repoUrl?.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (match) {
        setSelectedOwner(match[1])
        setSelectedRepo(match[2].replace('.git', ''))
      }
    } catch (error) {
      console.error('Error fetching task:', error)
    } finally {
      setFetchingTask(false)
    }
  }

  // Update repoUrl when owner/repo changes
  const handleOwnerChange = (owner: string) => {
    setSelectedOwner(owner)
    setSelectedRepo('')
    setFormData((prev) => ({ ...prev, repoUrl: '' }))
  }

  const handleRepoChange = (repo: string) => {
    setSelectedRepo(repo)
    if (selectedOwner && repo) {
      setFormData((prev) => ({ ...prev, repoUrl: `https://github.com/${selectedOwner}/${repo}` }))
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
          <Label>Repository</Label>
          <RepoSelector
            selectedOwner={selectedOwner}
            selectedRepo={selectedRepo}
            onOwnerChange={handleOwnerChange}
            onRepoChange={handleRepoChange}
            size="default"
          />
          {formData.repoUrl && <p className="text-xs text-muted-foreground mt-1">{formData.repoUrl}</p>}
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
          <Label htmlFor="selectedProvider">AI Provider</Label>
          <Select
            value={formData.selectedProvider}
            onValueChange={(value) => setFormData({ ...formData, selectedProvider: value })}
          >
            <SelectTrigger id="selectedProvider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {AI_PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
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
        <Button type="submit" disabled={loading || !formData.repoUrl}>
          {loading ? 'Saving...' : task || taskId ? 'Update' : 'Create'} Task
        </Button>
      </div>
    </form>
  )
}
