/**
 * AppLayout.tsx
 * Root layout shell — CSS Grid with grid-template-areas (spec requirement).
 * Renders: sidebar + header + main content area.
 */

import { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useDebounce } from '@/hooks/useDebounce'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import type { Board } from '@/types/entities'
import '@/styles/layout/AppLayout.css'

interface AppLayoutProps {
  boards: Board[]
  activeBoardId?: string
  onNewBoard: () => void
  onDeleteBoard: (boardId: string) => Promise<void>
  onSearch: (query: string) => void
}

export function AppLayout({ boards, activeBoardId, onNewBoard, onDeleteBoard, onSearch }: AppLayoutProps) {
  const [searchInput, setSearchInput] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const debouncedSearch = useDebounce(searchInput, 300)

  // Offline indicator — spec requirement
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Propagate debounced search up
  useEffect(() => {
    onSearch(debouncedSearch)
  }, [debouncedSearch, onSearch])

  // Spec: "/" focuses the search input
  const focusSearch = useCallback(() => {
    const el = document.getElementById('global-search') as HTMLInputElement | null
    el?.focus()
  }, [])

  useKeyboardShortcut({ '/': focusSearch })

  return (
    <div className="app-layout">
      <div className="app-layout__sidebar">
        <Sidebar boards={boards} activeBoardId={activeBoardId} onNewBoard={onNewBoard} onDeleteBoard={onDeleteBoard} />
      </div>

      <div className="app-layout__header">
        <Header searchValue={searchInput} onSearchChange={setSearchInput} isOnline={isOnline} />
      </div>

      <main className="app-layout__main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
