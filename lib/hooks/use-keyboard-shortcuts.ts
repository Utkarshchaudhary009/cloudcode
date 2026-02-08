'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

/**
 * Hook for global keyboard shortcuts
 *
 * Built-in shortcuts:
 * - Ctrl/Cmd + B: Toggle sidebar
 * - Ctrl/Cmd + K: Focus search / command palette (if available)
 * - Ctrl/Cmd + N: New task (navigate to home)
 * - Ctrl/Cmd + ,: Settings
 * - Escape: Close modals/dialogs
 */
export function useKeyboardShortcuts(
  customShortcuts?: KeyboardShortcut[],
  options?: {
    onToggleSidebar?: () => void
    onSearch?: () => void
    onEscape?: () => void
  },
) {
  const router = useRouter()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only allow Escape to work in inputs
        if (e.key !== 'Escape') return
      }

      const isModifier = e.metaKey || e.ctrlKey

      // Built-in shortcuts
      if (isModifier) {
        switch (e.key.toLowerCase()) {
          case 'b':
            // Toggle sidebar - handled by app-layout
            if (options?.onToggleSidebar) {
              e.preventDefault()
              options.onToggleSidebar()
            }
            break
          case 'k':
            // Search / command palette
            if (options?.onSearch) {
              e.preventDefault()
              options.onSearch()
            }
            break
          case 'n':
            // New task
            if (!e.shiftKey) {
              e.preventDefault()
              router.push('/')
            }
            break
          case ',':
            // Settings
            e.preventDefault()
            router.push('/settings')
            break
        }
      }

      // Escape key
      if (e.key === 'Escape') {
        if (options?.onEscape) {
          options.onEscape()
        }
      }

      // Custom shortcuts
      if (customShortcuts) {
        for (const shortcut of customShortcuts) {
          const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
          const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey || e.metaKey
          const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey || e.ctrlKey
          const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
          const altMatch = shortcut.alt ? e.altKey : !e.altKey

          // For ctrl/meta, treat them as equivalent (cross-platform)
          const modifierMatch = shortcut.ctrl || shortcut.meta ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey)

          if (keyMatch && modifierMatch && shiftMatch && altMatch) {
            e.preventDefault()
            shortcut.action()
            break
          }
        }
      }
    },
    [router, options, customShortcuts],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Keyboard shortcut reference for help dialog
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'B'], description: 'Toggle sidebar' },
  { keys: ['Ctrl', 'K'], description: 'Open search' },
  { keys: ['Ctrl', 'N'], description: 'New task' },
  { keys: ['Ctrl', ','], description: 'Open settings' },
  { keys: ['Esc'], description: 'Close dialog' },
] as const
