/**
 * ThemeContext.tsx
 * Manages light / dark / system theme.
 * Switches by adding/removing class "dark" on <html> (spec requirement).
 */

import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from '@/types/entities'

interface ThemeState {
  theme: Theme
}

function themeReducer(
  state: ThemeState,
  action: { type: 'SET_THEME'; payload: { theme: Theme } },
): ThemeState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload.theme }
    default:
      return state
  }
}

function applyTheme(theme: Theme): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'kanban:theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
  const [state, dispatch] = useReducer(themeReducer, { theme: stored })

  useEffect(() => {
    applyTheme(state.theme)
    localStorage.setItem(STORAGE_KEY, state.theme)
  }, [state.theme])

  // Re-apply when system preference changes (only matters in "system" mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (state.theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [state.theme])

  const setTheme = (theme: Theme) => dispatch({ type: 'SET_THEME', payload: { theme } })

  return (
    <ThemeContext.Provider value={{ theme: state.theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
