'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Github,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Search,
  X,
  ExternalLink,
  FileText,
  GitPullRequest,
} from 'lucide-react'
import Link from 'next/link'
import { useAtomValue } from 'jotai'
import { githubConnectionAtom } from '@/lib/atoms/github-connection'
import { sessionAtom } from '@/lib/atoms/session'
import { RepoSelector } from '@/components/repo-selector'
import { Label } from '@/components/ui/label'
import { DataTable, Column } from '@/components/data-table'

interface RepoWithReviewStatus {
  owner: string
  name: string
  full_name: string
  private: boolean
  description?: string
  autoReviewEnabled: boolean
  subscriptionId?: string
}

export default function CodeReviewPage() {
  const [repos, setRepos] = useState<RepoWithReviewStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingRepo, setTogglingRepo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // GitHub App install state
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [autoReviewEnabled, setAutoReviewEnabled] = useState(true)
  const [reviewOnDraft, setReviewOnDraft] = useState(false)
  const [installing, setInstalling] = useState(false)

  const githubConnection = useAtomValue(githubConnectionAtom)
  const session = useAtomValue(sessionAtom)

  const repoUrl = selectedOwner && selectedRepo ? `https://github.com/${selectedOwner}/${selectedRepo}` : ''

  // Fetch repos with review status
  const fetchRepos = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch user repos
      const reposRes = await fetch('/api/github/user-repos?per_page=100')
      if (!reposRes.ok) throw new Error('Failed to fetch repos')
      const reposData = await reposRes.json()

      // Fetch GitHub App installations to get auto-review status
      const installationsRes = await fetch('/api/github-installations')
      const installationsData = installationsRes.ok ? await installationsRes.json() : { installations: [] }

      // Map installations by repo path (owner/name) for quick lookup
      const installationMap = new Map<string, { enabled: boolean; id: string }>(
        (installationsData.installations || []).map((inst: any) => [
          inst.repoUrl?.replace('https://github.com/', ''),
          { enabled: inst.autoReviewEnabled, id: inst.id },
        ]),
      )

      const reposWithStatus: RepoWithReviewStatus[] = (reposData.repos || []).map((repo: any) => ({
        owner: repo.owner,
        name: repo.name,
        full_name: `${repo.owner}/${repo.name}`,
        private: repo.private,
        description: repo.description,
        autoReviewEnabled: installationMap.get(`${repo.owner}/${repo.name}`)?.enabled || false,
        subscriptionId: installationMap.get(`${repo.owner}/${repo.name}`)?.id,
      }))

      // Sort: subscribed first, then alphabetically
      reposWithStatus.sort((a, b) => {
        if (a.autoReviewEnabled && !b.autoReviewEnabled) return -1
        if (!a.autoReviewEnabled && b.autoReviewEnabled) return 1
        return a.full_name.localeCompare(b.full_name)
      })

      setRepos(reposWithStatus)
    } catch (error) {
      console.error('Error fetching repos', error)
      toast.error('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session.user && githubConnection.connected) {
      fetchRepos()
    } else {
      setLoading(false)
    }
  }, [session.user, githubConnection.connected, fetchRepos])

  // Toggle auto-review for a repo
  const handleToggleAutoReview = async (repo: RepoWithReviewStatus) => {
    setTogglingRepo(repo.full_name)
    try {
      if (repo.subscriptionId) {
        // Update existing subscription
        const res = await fetch('/api/github/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: repo.subscriptionId,
            autoReviewEnabled: !repo.autoReviewEnabled,
          }),
        })
        if (res.ok) {
          setRepos((prev) =>
            prev.map((r) => (r.full_name === repo.full_name ? { ...r, autoReviewEnabled: !r.autoReviewEnabled } : r)),
          )
          toast.success(repo.autoReviewEnabled ? 'Auto-review disabled' : 'Auto-review enabled')
        }
      } else {
        // Create new subscription (need to install GitHub App)
        toast.info('Please install the GitHub App to enable auto-review for this repository')
      }
    } catch (error) {
      toast.error('Failed to update auto-review status')
    } finally {
      setTogglingRepo(null)
    }
  }

  // Install GitHub App
  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoUrl) {
      toast.error('Please select a repository')
      return
    }

    setInstalling(true)
    try {
      const response = await fetch('/api/github/install/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          autoReviewEnabled,
          reviewOnDraft,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start GitHub App install')
      }

      if (data.installUrl) {
        window.location.assign(data.installUrl)
      }
    } catch (error) {
      console.error('Error installing GitHub App:', error)
      const message = error instanceof Error ? error.message : 'Failed to install GitHub App'
      toast.error(message)
    } finally {
      setInstalling(false)
    }
  }

  // Filter repos by search
  const filteredRepos = repos.filter(
    (repo) =>
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const enabledCount = repos.filter((r) => r.autoReviewEnabled).length

  // Define columns for the table
  const columns: Column<RepoWithReviewStatus>[] = [
    {
      header: 'Repository',
      cell: (repo) => (
        <div>
          <Link href={`/repos/${repo.full_name}`} className="font-medium hover:underline">
            {repo.full_name}
          </Link>
          {repo.description && <p className="text-sm text-muted-foreground truncate max-w-md">{repo.description}</p>}
        </div>
      ),
    },
    {
      header: 'Visibility',
      cell: (repo) => (
        <Badge variant={repo.private ? 'secondary' : 'outline'}>{repo.private ? 'Private' : 'Public'}</Badge>
      ),
    },
    {
      header: 'Auto-Review',
      cell: (repo) =>
        togglingRepo === repo.full_name ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Switch
            checked={repo.autoReviewEnabled}
            onCheckedChange={() => handleToggleAutoReview(repo)}
            disabled={!repo.subscriptionId}
          />
        ),
    },
    {
      header: 'Actions',
      className: 'w-[100px]',
      cell: (repo) => (
        <Button variant="ghost" size="sm" asChild>
          <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ),
    },
  ]

  // Not signed in
  if (!session.user) {
    return (
      <div className="container px-4 py-8 max-w-5xl">
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to manage code reviews.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // GitHub not connected
  if (!githubConnection.connected) {
    return (
      <div className="container px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitPullRequest className="h-8 w-8" />
            Code Review
          </h1>
          <p className="text-muted-foreground">Connect GitHub to enable automatic PR reviews on your repositories.</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect GitHub</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Connect your GitHub account to enable automatic code reviews on pull requests.
            </p>
            <Button asChild>
              <a href="/api/auth/signin/github">
                <Github className="h-4 w-4 mr-2" />
                Connect GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GitPullRequest className="h-8 w-8" />
              Code Review
            </h1>
            <p className="text-muted-foreground">Enable automatic AI-powered reviews on your pull requests.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/settings/review-rules">
                <FileText className="h-4 w-4 mr-2" />
                Review Rules
              </Link>
            </Button>
            <Button variant="outline" onClick={fetchRepos}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Banner */}
        {enabledCount > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{enabledCount} repositories with auto-review</p>
                    <p className="text-sm text-muted-foreground">PRs will be automatically reviewed</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/reviews">View Reviews →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Repository Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Add Repository
            </CardTitle>
            <CardDescription>Install the GitHub App on a repository to enable auto-reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInstall} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="mb-2 block">Repository</Label>
                <RepoSelector
                  selectedOwner={selectedOwner}
                  selectedRepo={selectedRepo}
                  onOwnerChange={(owner) => {
                    setSelectedOwner(owner)
                    setSelectedRepo('')
                  }}
                  onRepoChange={setSelectedRepo}
                  size="default"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="auto-review" checked={autoReviewEnabled} onCheckedChange={setAutoReviewEnabled} />
                  <Label htmlFor="auto-review" className="text-sm">
                    Auto-review PRs
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="draft-review" checked={reviewOnDraft} onCheckedChange={setReviewOnDraft} />
                  <Label htmlFor="draft-review" className="text-sm">
                    Include drafts
                  </Label>
                </div>
              </div>
              <Button type="submit" disabled={installing || !repoUrl}>
                {installing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Github className="h-4 w-4 mr-2" />}
                Install
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search */}
        {repos.length > 0 && (
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
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
        )}

        {/* Repos Table */}
        <DataTable
          data={filteredRepos}
          columns={columns}
          isLoading={loading}
          emptyMessage={searchQuery ? 'No matching repositories' : 'Connect repositories using the form above.'}
        />
      </div>
    </div>
  )
}
