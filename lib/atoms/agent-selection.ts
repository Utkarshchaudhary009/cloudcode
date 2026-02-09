import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai/utils'

// Last selected provider
export const lastSelectedProviderAtom = atomWithStorage<string | null>('last-selected-provider', null)

// Per-provider last selected model using atom family
export const lastSelectedModelAtomFamily = atomFamily((provider: string) =>
  atomWithStorage<string | null>(`last-selected-model-${provider}`, null),
)
