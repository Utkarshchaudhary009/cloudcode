import { getOpencodeClient, unwrapOpencodeResponse } from '@/lib/opencode/client.server'
import { buildStaticCatalog, mapProviderListToCatalog, type OpenCodeProviderCatalog } from './catalog'

export const getOpencodeProviderCatalog = async (): Promise<OpenCodeProviderCatalog> => {
  const client = getOpencodeClient()
  if (!client) {
    return buildStaticCatalog()
  }

  try {
    const response = await client.provider.list()
    const data = unwrapOpencodeResponse(response)

    if (!data) {
      return buildStaticCatalog()
    }

    return mapProviderListToCatalog(data)
  } catch {
    return buildStaticCatalog()
  }
}
