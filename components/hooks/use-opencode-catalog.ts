'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { buildStaticCatalog, type OpenCodeProviderCatalog } from '@/lib/opencode/catalog'

const STORAGE_KEY = 'opencode_catalog_cache'

export const useOpencodeCatalog = () => {
  const [catalog, setCatalog] = useState<OpenCodeProviderCatalog>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Simple validation to ensure it has providers
          if (parsed && parsed.providers && Array.isArray(parsed.providers)) {
            return parsed
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached catalog', e)
      }
    }
    return buildStaticCatalog()
  })

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      try {
        const response = await fetch('/api/opencode/providers')

        if (!response.ok) {
          throw new Error('Failed to fetch provider catalog')
        }

        const data = (await response.json()) as OpenCodeProviderCatalog

        if (!active) return

        // Check if we received valid data
        if (data.providers.length === 0) {
          // Only show error if we also don't have cached data
          if (catalog.providers.length === 0) {
            toast.error('Provider catalog is empty', {
              description: 'Could not retrieve available AI providers. Please check your connection or configuration.'
            })
          }
          return
        }

        setCatalog(data)

        // Cache the successful result
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch (e) {
          console.warn('Failed to cache catalog', e)
        }
      } catch (error) {
        if (!active) return

        console.error('Error loading catalog:', error)

        // Only show toast if we don't have cached data to fall back on
        if (catalog.providers.length === 0) {
          toast.error('Failed to load providers', {
            description: 'Could not connect to the provider catalog service.'
          })
        }
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [catalog.providers.length]) // Add dependency to check current state length for error logic

  return catalog
}
