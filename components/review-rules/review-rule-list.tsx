'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, FileText } from 'lucide-react'

export function ReviewRuleList() {
  const router = useRouter()
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/review-rules')
      const data = await response.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      await fetch(`/api/review-rules/${ruleId}`, { method: 'DELETE' })
      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const handleToggleEnabled = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return

    try {
      await fetch(`/api/review-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      fetchRules()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Rules</h1>
          <p className="text-muted-foreground">Manage custom code review rules for PR analysis</p>
        </div>
        <Button onClick={() => router.push('/settings/review-rules/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No review rules configured yet</p>
            <Button onClick={() => router.push('/settings/review-rules/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {rule.name}
                      {rule.enabled ? (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </CardTitle>
                    {rule.description && <CardDescription>{rule.description}</CardDescription>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.enabled} onCheckedChange={() => handleToggleEnabled(rule.id)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getSeverityColor(rule.severity)} className="uppercase">
                    {rule.severity}
                  </Badge>
                  {rule.repoUrl && (
                    <Badge variant="outline" className="truncate max-w-xs">
                      {rule.repoUrl}
                    </Badge>
                  )}
                  {rule.filePatterns && rule.filePatterns.length > 0 && (
                    <Badge variant="outline">
                      {rule.filePatterns.length} pattern{rule.filePatterns.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">{rule.prompt}</p>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/settings/review-rules/${rule.id}`)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
