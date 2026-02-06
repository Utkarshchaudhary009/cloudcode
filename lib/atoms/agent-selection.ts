import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai/utils'

// Last selected agent
export const lastSelectedAgentAtom = atomWithStorage<string | null>('last-selected-provider', null)

// Per-agent last selected model using atom family
export const lastSelectedModelAtomFamily = atomFamily((provider: string) =>
  atomWithStorage<string | null>(`last-selected-model-${provider}`, null),
)
