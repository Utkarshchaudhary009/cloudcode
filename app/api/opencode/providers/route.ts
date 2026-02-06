import { NextResponse } from 'next/server'
import { getOpencodeProviderCatalog } from '@/lib/opencode/catalog.server'

export async function GET() {
  const catalog = await getOpencodeProviderCatalog()
  return NextResponse.json(catalog)
}
