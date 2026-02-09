'use client'

import { useSetAtom } from 'jotai'
import { useEffect, ReactNode } from 'react'
import { headerLeftActionsAtom, headerRightActionsAtom } from '@/lib/atoms/header'

interface HeaderActions {
  left?: ReactNode
  right?: ReactNode
}

export function useHeaderActions({ left, right }: HeaderActions) {
  const setLeft = useSetAtom(headerLeftActionsAtom)
  const setRight = useSetAtom(headerRightActionsAtom)

  useEffect(() => {
    setLeft(left || null)
    setRight(right || null)

    return () => {
      setLeft(null)
      setRight(null)
    }
  }, [left, right, setLeft, setRight])
}
