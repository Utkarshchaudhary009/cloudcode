'use client'

import { useEffect, useState } from 'react'
import { ConnectionCard } from '@/components/integrations/connection-card'
import { Loader2 } from 'lucide-react'
import type { DeploymentProvider } from '@/lib/integrations/types'

interface ConnectionStatus {
  connected: boolean
  provider: DeploymentProvider
  username?: string
  connectedAt?: string
}

const PROVIDERS: { id: DeploymentProvider; name: string; description: string }[] = [
  { id: 'vercel', name: 'Vercel', description: 'Deploy and monitor Next.js applications' },
  { id: 'cloudflare', name: 'Cloudflare', description: 'Deploy workers and pages' },
  { id: 'render', name: 'Render', description: 'Deploy web services and background workers' },
]

export function IntegrationsList() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch('/api/integrations/vercel/status')
        const data = await res.json()
        setConnections({ vercel: data })
      } catch {
        // Handle error
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
  }, [])

  const handleDisconnect = async (provider: DeploymentProvider) => {
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: 'DELETE' })
      setConnections((prev) => ({
        ...prev,
        [provider]: { connected: false, provider },
      }))
    } catch {
      // Handle error
    }
  }

  const handleReconnect = async () => {
    try {
      const res = await fetch('/api/integrations/vercel/status')
      const data = await res.json()
      setConnections({ vercel: data })
    } catch {
      // Handle error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {PROVIDERS.map((provider) => {
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
  )
}
