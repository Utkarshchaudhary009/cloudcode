'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Rocket, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { MinimalDeploymentRow } from './deployment-row'
import type { MergedDeployment } from '@/lib/types/deployments'

interface DeploymentsTabProps {
  projectId?: string
  repoFullName?: string
}

const FILTER_STATES: Record<string, string | undefined> = {
  all: undefined,
  building: 'BUILDING,QUEUED',
  failed: 'ERROR',
  success: 'READY',
}

export function DeploymentsTab({ projectId, repoFullName }: DeploymentsTabProps) {
  const [deployments, setDeployments] = useState<MergedDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [nextSince, setNextSince] = useState<number | undefined>(undefined)
  const [hasMore, setHasMore] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const fetchDeployments = useCallback(
    async (since?: number, filter?: string) => {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (since) params.set('since', String(since))
      if (projectId) params.set('projectId', projectId)
      if (repoFullName) params.set('repo', repoFullName)
      if (filter && FILTER_STATES[filter]) {
        params.set('state', FILTER_STATES[filter]!)
      }

      const response = await fetch(`/api/integrations/vercel/deployments?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deployments')
      }

      return data
    },
    [projectId, repoFullName],
  )

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setNotConnected(false)

      const data = await fetchDeployments(undefined, activeFilter)

      if (data.deployments.length === 0 && !data.pagination?.next) {
        setDeployments([])
        setHasMore(false)
        return
      }

      setDeployments(data.deployments)
      setNextSince(data.pagination?.next)
      setHasMore(!!data.pagination?.next)
    } catch (err) {
      if (err instanceof Error && err.message.includes('not connected')) {
        setNotConnected(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load deployments')
      }
    } finally {
      setLoading(false)
    }
  }, [fetchDeployments, activeFilter])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextSince) return

    try {
      setLoadingMore(true)
      const data = await fetchDeployments(nextSince, activeFilter)

      setDeployments((prev) => [...prev, ...data.deployments])
      setNextSince(data.pagination?.next)
      setHasMore(!!data.pagination?.next)
    } catch (err) {
      console.error('Failed to load more deployments')
    } finally {
      setLoadingMore(false)
    }
  }, [fetchDeployments, activeFilter, loadingMore, hasMore, nextSince])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loadMore, hasMore, loadingMore])

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
    setDeployments([])
    setNextSince(undefined)
    setHasMore(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <LinkIcon className="size-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Vercel Not Connected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Connect your Vercel account to view deployments.
        </p>
        <Link href="/deployments?tab=projects" className="text-primary hover:underline">
          Go to Projects to connect
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="size-12 text-destructive" />
        <h3 className="text-lg font-semibold">Error Loading Deployments</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50">
        {Object.keys(FILTER_STATES).map((filter) => (
          <button
            key={filter}
            onClick={() => handleFilterChange(filter)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeFilter === filter ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Rocket className="size-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Deployments Found</h3>
            <p className="text-sm text-muted-foreground">
              {activeFilter === 'all' ? 'No deployments have been made yet.' : `No ${activeFilter} deployments.`}
            </p>
          </div>
        ) : (
          <>
            {deployments.map((deployment) => (
              <MinimalDeploymentRow key={deployment.id} deployment={deployment} />
            ))}

            <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
              {loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
