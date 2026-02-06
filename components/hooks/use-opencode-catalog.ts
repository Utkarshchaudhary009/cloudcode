'use client'

import { useEffect, useState } from 'react'
import { buildStaticCatalog, type OpenCodeProviderCatalog } from '@/lib/opencode/catalog'

export const useOpencodeCatalog = () => {
  const [catalog, setCatalog] = useState<OpenCodeProviderCatalog>(buildStaticCatalog())

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      const response = await fetch('/api/opencode/providers')
      if (!response.ok) return
      const data = (await response.json()) as OpenCodeProviderCatalog
      if (active) {
        setCatalog(data)
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  return catalog
}
