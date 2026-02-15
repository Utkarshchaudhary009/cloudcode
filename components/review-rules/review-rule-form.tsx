'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { RepoSelector } from '@/components/repo-selector'
import { parseGitHubRepoUrl } from '@/lib/utils/github-utils'

interface ReviewRuleFormProps {
  rule?: any
  ruleId?: string
  onSuccess?: () => void
}

export function ReviewRuleForm({ rule: initialRule, ruleId, onSuccess }: ReviewRuleFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetchingRule, setFetchingRule] = useState(!!ruleId && !initialRule)
  const [rule, setRule] = useState(initialRule)
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [formData, setFormData] = useState({
    name: initialRule?.name || '',
    description: initialRule?.description || '',
    prompt: initialRule?.prompt || '',
    severity: initialRule?.severity || 'warning',
    repoUrl: initialRule?.repoUrl || '',
    filePatterns: initialRule?.filePatterns || [],
    enabled: initialRule?.enabled ?? true,
  })

  useEffect(() => {
    if (formData.repoUrl) {
      const parsed = parseGitHubRepoUrl(formData.repoUrl)
      if (parsed) {
        setSelectedOwner(parsed.owner)
        setSelectedRepo(parsed.repo)
      }
    }
  }, [])

  useEffect(() => {
    if (ruleId && !initialRule) {
      fetchRule()
    }
  }, [ruleId])

  const fetchRule = async () => {
    try {
      const response = await fetch(`/api/review-rules/${ruleId}`)
      if (!response.ok) throw new Error('Rule not found')
      const data = await response.json()
      setRule(data.rule)
      setFormData({
        name: data.rule.name || '',
        description: data.rule.description || '',
        prompt: data.rule.prompt || '',
        severity: data.rule.severity || 'warning',
        repoUrl: data.rule.repoUrl || '',
        filePatterns: data.rule.filePatterns || [],
        enabled: data.rule.enabled ?? true,
      })
      const parsed = parseGitHubRepoUrl(data.rule.repoUrl)
      if (parsed) {
        setSelectedOwner(parsed.owner)
        setSelectedRepo(parsed.repo)
      }
    } catch (error) {
      console.error('Error fetching rule:', error)
    } finally {
      setFetchingRule(false)
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

  const handleClearRepo = () => {
    setSelectedOwner('')
    setSelectedRepo('')
    setFormData((prev) => ({ ...prev, repoUrl: '' }))
  }

  if (fetchingRule) {
    return <div className="flex items-center justify-center h-32">Loading...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const id = rule?.id || ruleId
    try {
      const url = id ? `/api/review-rules/${id}` : '/api/review-rules'
      const method = id ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save rule')

      onSuccess?.()
      if (!rule) {
        router.push('/settings/review-rules')
      }
    } catch (error) {
      console.error('Error saving rule:', error)
    } finally {
      setLoading(false)
    }
  }

  const addFilePattern = () => {
    setFormData({ ...formData, filePatterns: [...formData.filePatterns, ''] })
  }

  const removeFilePattern = (index: number) => {
    setFormData({
      ...formData,
      filePatterns: formData.filePatterns.filter((_: string, i: number) => i !== index),
    })
  }

  const updateFilePattern = (index: number, value: string) => {
    const newPatterns = [...formData.filePatterns]
    newPatterns[index] = value
    setFormData({ ...formData, filePatterns: newPatterns })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Rule Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Review Rule"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of what this rule checks"
          />
        </div>

        <div>
          <Label htmlFor="prompt">Review Prompt</Label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            placeholder="Describe what to look for in code reviews..."
            rows={4}
            required
          />
        </div>

        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Error (Critical)</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info (Suggestion)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Repository (Optional)</Label>
          <div className="flex items-center gap-2">
            <RepoSelector
              selectedOwner={selectedOwner}
              selectedRepo={selectedRepo}
              onOwnerChange={handleOwnerChange}
              onRepoChange={handleRepoChange}
              size="default"
            />
            {formData.repoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearRepo}>
                Clear
              </Button>
            )}
          </div>
          {formData.repoUrl ? (
            <p className="text-xs text-muted-foreground mt-1">{formData.repoUrl}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Leave empty to apply to all repositories</p>
          )}
        </div>

        <div>
          <Label>File Patterns (Optional)</Label>
          <div className="space-y-2">
            {formData.filePatterns.map((pattern: string, index: number) => (
              <div key={index} className="flex gap-2">
                <Input value={pattern} onChange={(e) => updateFilePattern(index, e.target.value)} placeholder="*.ts" />
                <Button type="button" variant="outline" size="icon" onClick={() => removeFilePattern(index)}>
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFilePattern}>
              Add Pattern
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Glob patterns like *.ts, *.tsx, src/**</p>
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
          {loading ? 'Saving...' : rule || ruleId ? 'Update' : 'Create'} Rule
        </Button>
      </div>
    </form>
  )
}
