/**
 * SearchContext.tsx
 * Shares board search and new-board dialog state across the layout shell.
 */

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface SearchContextValue {
  searchQuery: string
  newBoardDialogOpen: boolean
  openNewBoardDialog: () => void
  closeNewBoardDialog: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

interface SearchProviderProps {
  children: ReactNode
  value: SearchContextValue
}

export function SearchProvider({ children, value }: SearchProviderProps) {
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext)
  if (!context) throw new Error('useSearchContext must be used inside SearchProvider')
  return context
}
