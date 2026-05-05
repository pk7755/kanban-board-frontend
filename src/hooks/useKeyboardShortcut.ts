/**
 * useKeyboardShortcut.ts
 * Register keyboard shortcuts declaratively.
 * Shortcuts do NOT fire when focus is inside an input, textarea, or select,
 * unless `ignoreInputs` is explicitly set to false.
 *
 * Usage:
 *   useKeyboardShortcut({
 *     'n': () => openNewTask(),
 *     '/': () => focusSearch(),
 *     'Escape': () => closeModal(),
 *   })
 */

import { useEffect, useRef } from 'react'

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

interface UseKeyboardShortcutOptions {
  /** When true (default), shortcuts are suppressed inside form inputs */
  ignoreInputs?: boolean
  /** Whether to call e.preventDefault() on match. Default: true */
  preventDefault?: boolean
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcut(
  shortcuts: ShortcutMap,
  options: UseKeyboardShortcutOptions = {},
): void {
  const { ignoreInputs = true, preventDefault = true } = options

  // Keep a stable ref so shortcuts map doesn't need to be in the dep array
  const shortcutsRef = useRef<ShortcutMap>(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement

      if (ignoreInputs && INPUT_TAGS.has(target.tagName)) return
      if (ignoreInputs && target.isContentEditable) return

      // Build key string: modifiers + key (e.g. "Ctrl+z", "Shift+n", "Escape")
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
      if (e.shiftKey) parts.push('Shift')
      if (e.altKey) parts.push('Alt')
      parts.push(e.key)

      const key = parts.join('+')
      const handler = shortcutsRef.current[key] ?? shortcutsRef.current[e.key]

      if (handler) {
        if (preventDefault) e.preventDefault()
        handler(e)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [ignoreInputs, preventDefault])
}
