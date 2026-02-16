'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProjectRow } from './project-row'
import type { VercelProject, ProjectSubscription, DisplayProject } from '@/lib/types/projects'

interface VercelConnection {
  id: string
  connected: boolean
  username?: string
  teamId?: string
}

export function ProjectsTab() {
  const [connection, setConnection] = useState<VercelConnection | null>(null)
  const [projects, setProjects] = useState<VercelProject[]>([])
  const [subscriptions, setSubscriptions] = useState<ProjectSubscription[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState('vercel')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const statusRes = await fetch('/api/integrations/vercel/status')
        const statusData = await statusRes.json()
        setConnection(statusData)

        if (statusData.connected) {
          const [projectsRes, subsRes] = await Promise.all([
            fetch('/api/integrations/vercel/projects'),
            fetch('/api/integrations/vercel/subscriptions'),
          ])

          const projectsData = await projectsRes.json()
          const subsData = await subsRes.json()

          setProjects(projectsData.projects || [])
          setSubscriptions(subsData.subscriptions || [])
        }
      } catch {
        toast.error('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const displayProjects: DisplayProject[] = projects.map((project) => {
    const subscription = subscriptions.find((s) => s.platformProjectId === project.id)
    return {
      ...project,
      isMonitored: !!subscription,
      subscriptionId: subscription?.id,
      hasGitLink: !!project.link,
      githubRepo: project.link ? `${project.link.org}/${project.link.repo}` : null,
    }
  })

  const filteredProjects = displayProjects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleToggle = useCallback(
    async (project: DisplayProject, enabled: boolean) => {
      try {
        if (enabled) {
          const res = await fetch('/api/integrations/vercel/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platformProjectId: project.id,
              platformProjectName: project.name,
              githubRepoFullName: project.githubRepo,
              teamId: connection?.teamId,
            }),
          })

          if (!res.ok) {
            throw new Error('Failed to enable monitoring')
          }

          const data = await res.json()
          setSubscriptions((prev) => [
            ...prev,
            {
              id: data.id,
              platformProjectId: project.id,
              platformProjectName: project.name,
              githubRepoFullName: project.githubRepo || '',
              createdAt: new Date().toISOString(),
            },
          ])
          toast.success('Monitoring enabled')
        } else {
          if (!project.subscriptionId) return

          const res = await fetch(`/api/integrations/vercel/subscriptions?id=${project.subscriptionId}`, {
            method: 'DELETE',
          })

          if (!res.ok) {
            throw new Error('Failed to disable monitoring')
          }

          setSubscriptions((prev) => prev.filter((s) => s.platformProjectId !== project.id))
          toast.success('Monitoring disabled')
        }
      } catch {
        toast.error(enabled ? 'Failed to enable monitoring' : 'Failed to disable monitoring')
      }
    },
    [connection?.teamId],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!connection?.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm sm:text-base text-muted-foreground mb-4">
          Connect your Vercel account to start monitoring projects
        </p>
        <Button asChild>
          <Link href="/integrations">Connect Vercel</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vercel">Vercel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg divide-y">
        {filteredProjects.length === 0 ? (
          <div className="py-8 sm:py-12 text-center text-sm sm:text-base text-muted-foreground">
            {search ? 'No projects match your search' : 'No projects found'}
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div key={project.id} className="px-4">
              <ProjectRow
                projectId={project.id}
                projectName={project.name}
                githubRepo={project.githubRepo}
                hasGitLink={project.hasGitLink}
                isMonitored={project.isMonitored}
                subscriptionId={project.subscriptionId}
                onToggle={(enabled) => handleToggle(project, enabled)}
                externalUrl={
                  connection.teamId
                    ? `https://vercel.com/${connection.teamId}/${project.name}`
                    : `https://vercel.com/${project.name}`
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
