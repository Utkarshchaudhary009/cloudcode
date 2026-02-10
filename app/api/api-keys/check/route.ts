import { NextRequest, NextResponse } from 'next/server'
import { getUserApiKey } from '@/lib/api-keys/user-keys'
import { API_KEY_PROVIDER_LABELS, API_KEY_PROVIDER_SET, type ApiKeyProviderId } from '@/lib/api-keys/providers'
import { normalizeOpenCodeProvider, SUPPORTED_OPENCODE_PROVIDER_INPUTS } from '@/lib/opencode/providers'

type Provider = ApiKeyProviderId

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawProvider = searchParams.get('provider') || searchParams.get('agent')

    if (!rawProvider) {
      return NextResponse.json({ error: 'Provider parameter is required' }, { status: 400 })
    }

    if (
      !SUPPORTED_OPENCODE_PROVIDER_INPUTS.includes(rawProvider as (typeof SUPPORTED_OPENCODE_PROVIDER_INPUTS)[number])
    ) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Normalize provider
    const provider = normalizeOpenCodeProvider(rawProvider)

    if (!API_KEY_PROVIDER_SET.has(provider as Provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Check if API key is available (either user's or system)
    const apiKey = await getUserApiKey(provider as Provider)
    const hasKey = !!apiKey

    return NextResponse.json({
      success: true,
      hasKey,
      provider,
      providerName: API_KEY_PROVIDER_LABELS[provider as Provider],
    })
  } catch (error) {
    console.error('Error checking API key')
    return NextResponse.json({ error: 'Failed to check API key' }, { status: 500 })
  }
}
