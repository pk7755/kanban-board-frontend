/**
 * AppLayoutWrapper.tsx
 * Connects the router outlet to AppLayout.
 * Board data will be supplied by BoardContext in Phase 3.
 * For now it passes empty boards so the shell renders.
 */

import { useCallback } from 'react'
import { AppLayout } from './AppLayout'

export function AppLayoutWrapper() {
  // Phase 3 will replace these with real BoardContext values
  const handleNewBoard = useCallback(() => {}, [])
  const handleSearch = useCallback((_query: string) => {}, [])

  return (
    <AppLayout
      boards={[]}
      onNewBoard={handleNewBoard}
      onSearch={handleSearch}
    />
  )
}
