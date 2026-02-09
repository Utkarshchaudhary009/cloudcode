'use client'

import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { useTasks } from '@/components/app-layout'
import { User } from '@/components/auth/user'
import { useAtomValue } from 'jotai'
import { headerLeftActionsAtom, headerRightActionsAtom } from '@/lib/atoms/header'

interface SharedHeaderProps {
  leftActions?: React.ReactNode
  extraActions?: React.ReactNode
}

export function SharedHeader({ leftActions: propLeftActions, extraActions: propExtraActions }: SharedHeaderProps) {
  const { toggleSidebar } = useTasks()
  const atomLeftActions = useAtomValue(headerLeftActionsAtom)
  const atomExtraActions = useAtomValue(headerRightActionsAtom)

  const leftActions = propLeftActions || atomLeftActions
  const extraActions = propExtraActions || atomExtraActions

  return (
    <div className="px-0 pt-0.5 md:pt-3 pb-1.5 md:pb-4 overflow-visible">
      <div className="flex items-center justify-between gap-2 h-8 min-w-0">
        {/* Left side - Menu Button and Left Actions */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <Button onClick={toggleSidebar} variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
            <Menu className="h-4 w-4" />
          </Button>
          {leftActions}
        </div>

        {/* Actions - Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {extraActions}

          <User />
        </div>
      </div>
    </div>
  )
}
