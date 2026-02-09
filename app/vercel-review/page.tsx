'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Zap, Loader2, RefreshCw, CheckCircle, XCircle, Clock, Github, KeyRound, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface VercelProject {
  id: string
  name: string
  framework: string | null
  repoUrl: string | null
  latestDeploymentStatus: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | null
  latestDeploymentUrl: string | null
  updatedAt: number
  isSubscribed: boolean
  subscriptionId: string | null
  autoFixEnabled: boolean
}

interface VercelScope {
  id: string
  slug: string
  name: string
  type: 'personal' | 'team'
}

const statusConfig = {
  READY: { label: 'Live', icon: CheckCircle, color: 'text-green-500' },
  ERROR: { label: 'Error', icon: XCircle, color: 'text-red-500' },
  BUILDING: { label: 'Building', icon: Loader2, color: 'text-blue-500' },
  QUEUED: { label: 'Queued', icon: Clock, color: 'text-yellow-500' },
}

export default function VercelReviewPage() {
  const [projects, setProjects] = useState<VercelProject[]>([])
  const [loading, setLoading] = useState(true)
  const [needsVercelAuth, setNeedsVercelAuth] = useState(false)
  const [togglingProject, setTogglingProject] = useState<string | null>(null)
  const [connectingVercel, setConnectingVercel] = useState(false)
  const [scopes, setScopes] = useState<VercelScope[]>([])
  const [selectedScopeId, setSelectedScopeId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadScopes = useCallback(async () => {
    try {
      const res = await fetch('/api/vercel/teams')
      if (!res.ok) {
        setScopes([])
        return
      }
      const data = await res.json()
      if (Array.isArray(data.scopes)) {
        setScopes(data.scopes)
      }
    } catch (error) {
      // Silently fail
    }
  }, [])

  const buildProjectsUrl = useCallback((scope?: VercelScope) => {
    if (scope?.type === 'team' && scope.id) {
      return `/api/vercel/projects?teamId=${scope.id}`
    }
    return '/api/vercel/projects'
  }, [])

  const sortProjects = useCallback((items: VercelProject[]) => {
    return [...items].sort((a, b) => {
      if (a.isSubscribed && !b.isSubscribed) return -1
      if (!a.isSubscribed && b.isSubscribed) return 1
      return a.name.localeCompare(b.name)
    })
  }, [])

  const fetchProjects = useCallback(
    async (scopeId: string) => {
      setLoading(true)
      try {
        if (scopeId === 'all') {
          if (scopes.length === 0) {
            const res = await fetch('/api/vercel/projects')
            const data = await res.json()
            if (data.needsVercelAuth) {
              setNeedsVercelAuth(true)
              setProjects([])
            } else if (data.success) {
              setProjects(sortProjects(data.projects))
              setNeedsVercelAuth(false)
            }
            return
          }
          const responses = await Promise.all(
            scopes.map(async (scope) => {
              const res = await fetch(buildProjectsUrl(scope))
              return res.json()
            }),
          )
          if (responses.some((r) => r.needsVercelAuth)) {
            setNeedsVercelAuth(true)
            setProjects([])
          } else {
            const combined = responses.flatMap((r) => (r.success ? r.projects : []))
            const unique = new Map<string, VercelProject>()
            combined.forEach((p) => {
              if (!unique.has(p.id)) unique.set(p.id, p)
            })
            setProjects(sortProjects([...unique.values()]))
            setNeedsVercelAuth(false)
          }
        } else {
          const scope = scopes.find((s) => s.id === scopeId)
          const res = await fetch(buildProjectsUrl(scope))
          const data = await res.json()
          if (data.needsVercelAuth) {
            setNeedsVercelAuth(true)
            setProjects([])
          } else if (data.success) {
            setProjects(sortProjects(data.projects))
            setNeedsVercelAuth(false)
          }
        }
      } catch (error) {
        toast.error('Failed to load projects')
      } finally {
        setLoading(false)
      }
    },
    [buildProjectsUrl, scopes, sortProjects],
  )

  useEffect(() => {
    loadScopes()
  }, [loadScopes])

  useEffect(() => {
    fetchProjects(selectedScopeId)
  }, [fetchProjects, selectedScopeId])

  const handleConnectVercel = async () => {
    setConnectingVercel(true)
    try {
      const res = await fetch('/api/auth/signin/vercel?next=/vercel-review', {
        method: 'POST',
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
        return
      }
      toast.error('Failed to start Vercel connection')
    } catch (error) {
      toast.error('Failed to start Vercel connection')
    } finally {
      setConnectingVercel(false)
    }
  }

  const handleToggleAutoFix = async (project: VercelProject) => {
    setTogglingProject(project.id)
    try {
      if (project.isSubscribed) {
        const res = await fetch('/api/vercel/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: project.subscriptionId,
            enabled: !project.autoFixEnabled,
          }),
        })
        if (res.ok) {
          setProjects((prev) =>
            prev.map((p) => (p.id === project.id ? { ...p, autoFixEnabled: !p.autoFixEnabled } : p)),
          )
          toast.success(project.autoFixEnabled ? 'Auto-fix disabled' : 'Auto-fix enabled')
        }
      } else {
        const res = await fetch('/api/vercel/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            repoUrl: project.repoUrl,
            selectedAgent: 'openai',
            maxAttempts: 5,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? { ...p, isSubscribed: true, subscriptionId: data.subscription.id, autoFixEnabled: true }
                : p,
            ),
          )
          toast.success('Auto-fix enabled for ' + project.name)
        } else {
          toast.error(data.error || 'Failed to enable auto-fix')
        }
      }
    } catch (error) {
      toast.error('Failed to update auto-fix status')
    } finally {
      setTogglingProject(null)
    }
  }

  const DeploymentStatus = ({ status }: { status: VercelProject['latestDeploymentStatus'] }) => {
    if (!status) return <span className="text-muted-foreground text-sm">—</span>
    const config = statusConfig[status]
    if (!config) return null
    const Icon = config.icon
    return (
      <div className={`flex items-center gap-1.5 ${config.color}`}>
        <Icon className={`h-4 w-4 ${status === 'BUILDING' ? 'animate-spin' : ''}`} />
        <span className="text-sm">{config.label}</span>
      </div>
    )
  }

  // Filter projects by search
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.repoUrl?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const enabledCount = projects.filter((p) => p.autoFixEnabled).length

  if (loading) {
    return (
      <div className="container py-8 max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (needsVercelAuth) {
    return (
      <div className="flex-1 bg-background flex flex-col">
        <div className="container py-8 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8" />
              Vercel Auto-Fix
            </h1>
            <p className="text-muted-foreground">Connect Vercel to enable AI-powered build failure fixes.</p>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Connect Your Vercel Account</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Connect Vercel to automatically detect your projects and enable AI-powered build fixes.
              </p>
              <Button size="lg" onClick={handleConnectVercel} disabled={connectingVercel}>
                {connectingVercel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Connect Vercel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8" />
              Vercel Auto-Fix
            </h1>
            <p className="text-muted-foreground">
              Enable auto-fix on any project. We&apos;ll automatically fix build failures with AI.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/vercel-fixes">View Build Fixes</Link>
            </Button>
            <Button variant="outline" onClick={() => fetchProjects(selectedScopeId)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Scope Selector */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Choose a Vercel scope to load projects.</div>
          <div className="w-full sm:w-64">
            <Select value={selectedScopeId} onValueChange={setSelectedScopeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {scopes.map((scope) => (
                  <SelectItem key={scope.id} value={scope.id}>
                    {scope.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Banner */}
        {enabledCount > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{enabledCount} projects protected</p>
                    <p className="text-sm text-muted-foreground">Build failures will be automatically fixed</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/vercel-fixes">View Activity →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        {projects.length > 0 && (
          <div className="mb-4">
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}

        {/* Projects Table */}
        {filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No matching projects' : 'No Vercel Projects Found'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term.' : 'Make sure your Vercel account has projects available.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Auto-Fix</TableHead>
                  <TableHead className="w-[80px]">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id} className={project.autoFixEnabled ? 'bg-green-500/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{project.name}</span>
                        {project.framework && (
                          <Badge variant="secondary" className="text-xs">
                            {project.framework}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DeploymentStatus status={project.latestDeploymentStatus} />
                    </TableCell>
                    <TableCell>
                      {project.repoUrl ? (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Github className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[150px]">
                            {project.repoUrl.replace('https://github.com/', '')}
                          </span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {togglingProject === project.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch checked={project.autoFixEnabled} onCheckedChange={() => handleToggleAutoFix(project)} />
                      )}
                    </TableCell>
                    <TableCell>
                      {project.latestDeploymentUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={project.latestDeploymentUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}
