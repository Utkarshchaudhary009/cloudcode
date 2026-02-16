'use client'

import { useEffect, useState } from 'react'
import { ConnectionCard } from '@/components/integrations/connection-card'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { DeploymentProvider } from '@/lib/integrations/types'
import { availableProviders } from '@/lib/integrations/registry'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ConnectionStatus {
  id?: string
  connected: boolean
  provider: DeploymentProvider
  username?: string
  connectedAt?: string
  teamId?: string | null
}

interface Subscription {
  id: string
  platformProjectId: string
  platformProjectName: string
  githubRepoFullName: string
  autoFixEnabled: boolean
}

interface Project {
  id: string
  name: string
  framework?: string
}

interface GitHubRepo {
  full_name: string
  name: string
}

export function IntegrationsList() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({})
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [configuring, setConfiguring] = useState(false)

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/integrations/vercel/status')
      const data = await res.json()
      setConnections({ vercel: data })
    } catch {
      // Handle error
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/integrations/vercel/subscriptions')
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
    } catch {
      // Handle error
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([fetchConnections(), fetchSubscriptions()])
      setLoading(false)
    }
    init()
  }, [])

  const handleDisconnect = async (provider: DeploymentProvider) => {
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: 'DELETE' })
      setConnections((prev) => ({
        ...prev,
        [provider]: { connected: false, provider, id: undefined },
      }))
      setSubscriptions([])
      toast.success(`${provider} disconnected`)
    } catch {
      toast.error(`Failed to disconnect ${provider}`)
    }
  }

  const handleReconnect = async () => {
    await fetchConnections()
  }

  const handleOpenConfig = async () => {
    setShowConfigDialog(true)
    setLoadingProjects(true)
    setLoadingRepos(true)
    try {
      const [projRes, repoRes] = await Promise.all([
        fetch('/api/integrations/vercel/projects'),
        fetch('/api/github/user-repos?per_page=100'),
      ])
      const projData = await projRes.json()
      const repoData = await repoRes.json()
      setProjects(projData.projects || [])
      setUserRepos(repoData.repos || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoadingProjects(false)
      setLoadingRepos(false)
    }
  }

  const handleAddSubscription = async () => {
    if (!selectedProjectId || !githubRepo) {
      toast.error('Please select a project and enter a GitHub repo')
      return
    }

    const project = projects.find((p) => p.id === selectedProjectId)
    if (!project) return

    setConfiguring(true)
    try {
      const vercelConn = connections.vercel
      if (!vercelConn?.id) {
        toast.error('Vercel connection not found')
        return
      }

      const res = await fetch('/api/integrations/vercel/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: vercelConn.id,
          platformProjectId: project.id,
          platformProjectName: project.name,
          githubRepoFullName: githubRepo,
          autoFixEnabled: true,
          teamId: vercelConn.teamId,
        }),
      })

      if (res.ok) {
        toast.success('Subscription added')
        setShowConfigDialog(false)
        fetchSubscriptions()
        setSelectedProjectId('')
        setGithubRepo('')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to add subscription')
      }
    } catch {
      toast.error('Error adding subscription')
    } finally {
      setConfiguring(false)
    }
  }

  const handleDeleteSubscription = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/vercel/subscriptions?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Subscription removed')
        fetchSubscriptions()
      }
    } catch {
      toast.error('Failed to remove subscription')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const vercelConnected = connections.vercel?.connected

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {availableProviders.map((provider) => {
          const connection = connections[provider.id]
          return (
            <ConnectionCard
              key={provider.id}
              provider={provider.id}
              name={provider.name}
              connected={connection?.connected ?? false}
              username={connection?.username}
              onDisconnect={() => handleDisconnect(provider.id)}
              onReconnect={handleReconnect}
            />
          )
        })}
      </div>

      {vercelConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Subscriptions</h2>
            <Button onClick={handleOpenConfig} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </div>

          {subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No projects configured yet. Click &ldquo;Add Project&rdquo; to start monitoring deployments.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {subscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{sub.platformProjectName}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => handleDeleteSubscription(sub.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GitHub Repo</span>
                        <span className="font-medium">{sub.githubRepoFullName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Auto-fix</span>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          Enabled
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Vercel Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project">Vercel Project</Label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading projects...
                </div>
              ) : (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repo">GitHub Repository</Label>
              {loadingRepos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading repositories...
                </div>
              ) : (
                <Select value={githubRepo} onValueChange={setGithubRepo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {userRepos.map((repo) => (
                      <SelectItem key={repo.full_name} value={repo.full_name}>
                        {repo.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubscription} disabled={configuring}>
              {configuring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
