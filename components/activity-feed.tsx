'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  X,
  Loader2,
  ListTodo,
  GitPullRequest,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { StatusDot } from '@/components/status-badge'
import { useAtomValue } from 'jotai'
import { sessionAtom } from '@/lib/atoms/session'
import type { Session } from '@/lib/session/types'

type FeedTab = 'all' | 'tasks' | 'code-review' | 'vercel' | 'scheduled'

interface FeedItem {
  id: string
  type: 'task' | 'review' | 'vercel-fix' | 'scheduled'
  title: string
  subtitle?: string
  status?: string
  repoName?: string
  createdAt: Date
  href: string
}

interface ActivityFeedProps {
  className?: string
  user?: Session['user'] | null
}

// Helper to group items by time
function groupByTime(items: FeedItem[]): Record<string, FeedItem[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const groups: Record<string, FeedItem[]> = {
    Today: [],
    Yesterday: [],
    'This Month': [],
    Older: [],
  }

  items.forEach((item) => {
    const itemDate = new Date(item.createdAt)
    if (isNaN(itemDate.getTime())) return // Skip invalid dates

    if (itemDate >= today) {
      groups['Today'].push(item)
    } else if (itemDate >= yesterday) {
      groups['Yesterday'].push(item)
    } else if (itemDate >= thisMonth) {
      groups['This Month'].push(item)
    } else {
      groups['Older'].push(item)
    }
  })

  return groups
}

const tabs: { id: FeedTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: ListTodo },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'code-review', label: 'Code Review', icon: GitPullRequest },
  { id: 'vercel', label: 'Vercel', icon: Zap },
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
]

export function ActivityFeed({ className, user: propUser }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const session = useAtomValue(sessionAtom)
  const user = propUser || session.user

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const allItems: FeedItem[] = []

      // Fetch each category independently
      const results = await Promise.allSettled([
        fetch('/api/tasks').then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch tasks')
          const data = await res.json()
          return (data.tasks || []).map((task: any) => ({
            id: task.id,
            type: 'task' as const,
            title: task.title || task.prompt?.slice(0, 60) || 'Untitled task',
            subtitle: task.repoUrl ? extractRepoName(task.repoUrl) : undefined,
            status: task.status,
            repoName: task.repoUrl ? extractRepoName(task.repoUrl) : undefined,
            createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
            href: `/tasks/${task.id}`,
          }))
        }),
        fetch('/api/reviews').then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch reviews')
          const data = await res.json()
          return (data.reviews || []).map((review: any) => ({
            id: review.id,
            type: 'review' as const,
            title: review.prTitle || `PR #${review.prNumber}` || 'Code Review',
            subtitle: review.repoUrl ? extractRepoName(review.repoUrl) : undefined,
            status: review.status,
            repoName: review.repoUrl ? extractRepoName(review.repoUrl) : undefined,
            createdAt: review.createdAt ? new Date(review.createdAt) : new Date(),
            href: `/reviews/${review.id}`,
          }))
        }),
        fetch('/api/vercel/build-fixes').then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch build fixes')
          const data = await res.json()
          return (data.fixes || []).map((fix: any) => ({
            id: fix.id,
            type: 'vercel-fix' as const,
            title: fix.projectName || 'Build Fix',
            subtitle: fix.status,
            status: fix.status,
            createdAt: fix.createdAt ? new Date(fix.createdAt) : new Date(),
            href: `/vercel-fixes/${fix.id}`,
          }))
        }),
        fetch('/api/scheduled-tasks').then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch scheduled tasks')
          const data = await res.json()
          return (data.tasks || []).map((task: any) => ({
            id: task.id,
            type: 'scheduled' as const,
            title: task.name || task.prompt?.slice(0, 60) || 'Scheduled Task',
            subtitle: task.timeSlot || 'Scheduled',
            status: task.enabled ? 'active' : 'paused',
            repoName: task.repoUrl ? extractRepoName(task.repoUrl) : undefined,
            createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
            href: `/scheduled-tasks/${task.id}`,
          }))
        }),
      ])

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value)
        } else {
          console.error('Error fetching one of the feed categories:', result.reason)
        }
      })

      // Sort by date (newest first)
      allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setItems(allItems)
    } catch (error) {
      console.error('Error fetching feed data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter items by tab and search
  const filteredItems = useMemo(() => {
    let filtered = items

    // Filter by tab
    if (activeTab !== 'all') {
      const typeMap: Record<FeedTab, string> = {
        all: '',
        tasks: 'task',
        'code-review': 'review',
        vercel: 'vercel-fix',
        scheduled: 'scheduled',
      }
      filtered = filtered.filter((item) => item.type === typeMap[activeTab])
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.subtitle?.toLowerCase().includes(query) ||
          item.repoName?.toLowerCase().includes(query),
      )
    }

    return filtered
  }, [items, activeTab, searchQuery])

  const groupedItems = useMemo(() => groupByTime(filteredItems), [filteredItems])

  // Helper function
  function extractRepoName(url: string): string {
    try {
      const urlObj = new URL(url)
      const parts = urlObj.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1].replace(/\.git$/, '')}`
      }
    } catch {}
    return url
  }

  // Get icon for item type
  function getItemIcon(type: FeedItem['type']) {
    switch (type) {
      case 'task':
        return ListTodo
      case 'review':
        return GitPullRequest
      case 'vercel-fix':
        return Zap
      case 'scheduled':
        return Clock
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or repo name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const count =
            tab.id === 'all'
              ? items.length
              : items.filter((i) => {
                  if (tab.id === 'tasks') return i.type === 'task'
                  if (tab.id === 'code-review') return i.type === 'review'
                  if (tab.id === 'vercel') return i.type === 'vercel-fix'
                  if (tab.id === 'scheduled') return i.type === 'scheduled'
                  return false
                }).length

          return (
            <Button
              key={tab.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn('h-8 px-3 text-xs gap-1.5 flex-shrink-0', isActive && 'bg-accent')}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                  {count}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>

      {/* Feed Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? `No results for "${searchQuery}"` : 'No activity yet. Create your first task above!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedItems).map(([label, groupItems]) => {
            if (groupItems.length === 0) return null

            return (
              <div key={label}>
                <h3 className="text-xs font-medium text-muted-foreground mb-3 px-1">{label}</h3>
                <div className="space-y-3">
                  {groupItems.map((item) => {
                    const Icon = getItemIcon(item.type)
                    return (
                      <Link key={item.id} href={item.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div
                              className={cn(
                                'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                item.type === 'task' && 'bg-blue-500/10 text-blue-500',
                                item.type === 'review' && 'bg-purple-500/10 text-purple-500',
                                item.type === 'vercel-fix' && 'bg-orange-500/10 text-orange-500',
                                item.type === 'scheduled' && 'bg-green-500/10 text-green-500',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  {item.repoName && <GitBranch className="h-3 w-3" />}
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                            {item.status && (
                              <div className="flex-shrink-0">
                                {item.type === 'task' ? (
                                  <StatusDot status={item.status} />
                                ) : (
                                  <Badge
                                    variant={
                                      item.status === 'completed' || item.status === 'active'
                                        ? 'default'
                                        : item.status === 'error'
                                          ? 'destructive'
                                          : 'secondary'
                                    }
                                    className="text-[10px]"
                                  >
                                    {item.status}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
