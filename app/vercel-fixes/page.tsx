'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Zap, ExternalLink, Loader2, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface BuildFix {
  id: string
  subscriptionId: string
  deploymentId: string
  deploymentUrl: string | null
  branch: string
  buildError: string | null
  status: 'pending' | 'fixing' | 'success' | 'failed' | 'exhausted'
  attempts: number
  lastFixCommit: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  projectName: string
  projectId: string
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-500' },
  fixing: { label: 'Fixing', icon: Loader2, color: 'bg-blue-500' },
  success: { label: 'Fixed', icon: CheckCircle, color: 'bg-green-500' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-500' },
  exhausted: { label: 'Exhausted', icon: AlertTriangle, color: 'bg-orange-500' },
}

export default function VercelFixesPage() {
  const [fixes, setFixes] = useState<BuildFix[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)

  useEffect(() => {
    fetchFixes()
  }, [])

  const fetchFixes = async () => {
    try {
      const res = await fetch('/api/vercel/build-fixes')
      const data = await res.json()
      if (data.success) {
        setFixes(data.fixes)
      }
    } catch (error) {
      console.error('Error fetching fixes:', error)
      toast.error('Failed to load build fixes')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (buildFixId: string) => {
    setRetrying(buildFixId)
    try {
      const res = await fetch('/api/vercel/build-fixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildFixId }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Fix retry triggered')
        fetchFixes()
      } else {
        toast.error(data.error || 'Failed to trigger retry')
      }
    } catch (error) {
      toast.error('Failed to trigger retry')
    } finally {
      setRetrying(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const StatusBadge = ({ status }: { status: BuildFix['status'] }) => {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge variant="secondary" className={`${config.color} text-white`}>
        <Icon className={`h-3 w-3 mr-1 ${status === 'fixing' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="container px-4 py-8 max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Zap className="h-8 w-8" />
              Build Fixes
            </h1>
            <p className="text-muted-foreground">Track and manage automatic build fix attempts</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/vercel-auto-fix">
              <Button variant="outline">Manage Subscriptions</Button>
            </Link>
            <Button variant="outline" onClick={fetchFixes}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : fixes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">No Build Fixes</h3>
              <p className="text-muted-foreground">
                All your builds are passing, or you haven&apos;t subscribed to any projects yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {fixes.map((fix) => (
              <Card key={fix.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{fix.projectName}</CardTitle>
                      <StatusBadge status={fix.status} />
                    </div>
                    <CardDescription>
                      Branch: <span className="font-mono">{fix.branch}</span> · Attempts: {fix.attempts}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {fix.deploymentUrl && (
                      <a href={fix.deploymentUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Deployment
                        </Button>
                      </a>
                    )}
                    {(fix.status === 'failed' || fix.status === 'exhausted') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(fix.id)}
                        disabled={retrying === fix.id}
                      >
                        {retrying === fix.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Retry Fix
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>Started: {formatDate(fix.createdAt)}</span>
                      {fix.completedAt && <span>Completed: {formatDate(fix.completedAt)}</span>}
                    </div>
                    {fix.buildError && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View Build Error
                        </summary>
                        <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
                          {fix.buildError}
                        </pre>
                      </details>
                    )}
                    {fix.lastFixCommit && (
                      <p className="text-muted-foreground">
                        Last fix commit: <span className="font-mono">{fix.lastFixCommit}</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
